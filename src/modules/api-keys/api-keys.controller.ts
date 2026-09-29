import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsObject, IsOptional } from 'class-validator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../enums';
import { ApiKeysService } from './api-keys.service';
import { ApiKeyScopeQueryDto, CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';
import { ApiKey } from './entities/api-key.entity';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AuditActionType, AuditStatus } from '../audit-log/entities/audit-log.entity';
import { Practitioner } from '../practitioners/entities/practitioner.entity';
import { S3StorageService } from '../../common/storage/s3-storage.service';
import { clinicLogoUploadOptions } from '../clinics/upload/clinic-logo.upload';

const DAY_KEYS = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'];
const HOURS_PATTERN = /^(tutup|\d{2}:\d{2}-\d{2}:\d{2})$/i;

class UpdatePractitionerScheduleDto {
  /** { senin: '08:00-14:00', ..., minggu: 'Tutup' }; null = follow clinic hours. */
  @IsOptional()
  @IsObject()
  jadwalPraktik: Record<string, string> | null;
}

/** What the UI may see of a key — never the hash. */
function view(k: ApiKey) {
  return {
    id: k.id,
    name: k.name,
    type: k.type,
    keyPrefix: k.keyPrefix,
    allowedOrigins: k.allowedOrigins ?? [],
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
    revokedAt: k.revokedAt,
  };
}

/**
 * Pengaturan → API: API keys, usage against the plan's limits, and the
 * doctors' public profile (photo, practice hours) the API serves.
 * Owner (own clinic) and Super Admin (any clinic, via ?clinicId) only.
 */
@ApiTags('settings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
@Controller('settings/api')
export class ApiKeysController {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly auditLogService: AuditLogService,
    private readonly storage: S3StorageService,
    @InjectRepository(Practitioner) private readonly practitionerRepository: Repository<Practitioner>,
  ) {}

  @Get('keys')
  @ApiOperation({ summary: 'List API keys' })
  async list(@CurrentUser() user: any, @Query() q: ApiKeyScopeQueryDto) {
    const clinicId = this.scope(user, q.clinicId);
    return { success: true, data: (await this.apiKeysService.list(clinicId)).map(view) };
  }

  @Post('keys')
  @ApiOperation({ summary: 'Create an API key — the plaintext key is returned once' })
  async create(@CurrentUser() user: any, @Body() dto: CreateApiKeyDto, @Req() req: any) {
    const clinicId = this.scope(user, dto.clinicId);
    const { apiKey, rawKey } = await this.apiKeysService.create(clinicId, dto, user.userId);
    this.audit(user, clinicId, req, AuditActionType.CREATE, apiKey, `API key dibuat: ${apiKey.name} (${apiKey.type})`);
    return { success: true, data: { ...view(apiKey), key: rawKey } };
  }

  @Patch('keys/:id')
  @ApiOperation({ summary: 'Rename a key or change its allowed domains' })
  async update(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ApiKeyScopeQueryDto,
    @Body() dto: UpdateApiKeyDto,
    @Req() req: any,
  ) {
    const clinicId = this.scope(user, q.clinicId);
    const apiKey = await this.apiKeysService.update(id, clinicId, dto);
    this.audit(user, clinicId, req, AuditActionType.UPDATE, apiKey, `API key diubah: ${apiKey.name}`);
    return { success: true, data: view(apiKey) };
  }

  @Post('keys/:id/revoke')
  @ApiOperation({ summary: 'Revoke a key immediately' })
  async revoke(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number, @Query() q: ApiKeyScopeQueryDto, @Req() req: any) {
    const clinicId = this.scope(user, q.clinicId);
    const apiKey = await this.apiKeysService.revoke(id, clinicId);
    this.audit(user, clinicId, req, AuditActionType.DELETE, apiKey, `API key dicabut: ${apiKey.name}`);
    return { success: true, data: view(apiKey) };
  }

  @Post('keys/:id/rotate')
  @ApiOperation({ summary: 'Replace a key with a new secret (old one is revoked)' })
  async rotate(@CurrentUser() user: any, @Param('id', ParseIntPipe) id: number, @Query() q: ApiKeyScopeQueryDto, @Req() req: any) {
    const clinicId = this.scope(user, q.clinicId);
    const { apiKey, rawKey } = await this.apiKeysService.rotate(id, clinicId, user.userId);
    this.audit(user, clinicId, req, AuditActionType.UPDATE, apiKey, `API key dirotasi: ${apiKey.name}`);
    return { success: true, data: { ...view(apiKey), key: rawKey } };
  }

  @Get('usage')
  @ApiOperation({ summary: 'Requests per day (last 30 days) against the plan limits' })
  async usage(@CurrentUser() user: any, @Query() q: ApiKeyScopeQueryDto) {
    const clinicId = this.scope(user, q.clinicId);
    return { success: true, data: await this.apiKeysService.usage(clinicId, 30) };
  }

  // ----- doctors' public profile (served by /v1/practitioners) -----

  @Get('practitioners')
  @ApiOperation({ summary: "Doctors' public profile: photo and practice hours" })
  async practitioners(@CurrentUser() user: any, @Query() q: ApiKeyScopeQueryDto) {
    const clinicId = this.scope(user, q.clinicId);
    const rows = await this.practitionerRepository.find({
      where: { clinicId },
      select: { id: true, name: true, specialization: true, photoUrl: true, jadwalPraktik: true, isActive: true },
      order: { id: 'ASC' },
    });
    return { success: true, data: rows };
  }

  @Put('practitioners/:id/schedule')
  @ApiOperation({ summary: "Set a doctor's practice hours (null = follow the clinic)" })
  async setSchedule(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ApiKeyScopeQueryDto,
    @Body() dto: UpdatePractitionerScheduleDto,
    @Req() req: any,
  ) {
    const clinicId = this.scope(user, q.clinicId);
    const practitioner = await this.findPractitioner(id, clinicId);
    practitioner.jadwalPraktik = this.validSchedule(dto.jadwalPraktik ?? null);
    await this.practitionerRepository.save(practitioner);
    void this.auditLogService.record({
      clinicId, actorId: user.userId, actorName: user.name ?? user.email, actorRole: user.role,
      actionType: AuditActionType.UPDATE, entityType: 'Practitioner', entityId: id,
      entityLabel: `Jadwal praktik ${practitioner.name}`, status: AuditStatus.SUCCESS,
      ipAddress: req.ip, userAgent: req.headers?.['user-agent'],
    });
    return { success: true, data: { id, jadwalPraktik: practitioner.jadwalPraktik } };
  }

  @Post('practitioners/:id/photo')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: "Upload a doctor's profile photo (JPG/PNG/WEBP, max 5MB)" })
  @UseInterceptors(FileInterceptor('file', clinicLogoUploadOptions))
  async uploadPhoto(
    @CurrentUser() user: any,
    @Param('id', ParseIntPipe) id: number,
    @Query() q: ApiKeyScopeQueryDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const clinicId = this.scope(user, q.clinicId);
    if (!file) throw new BadRequestException('File foto wajib diunggah');
    const practitioner = await this.findPractitioner(id, clinicId);
    const ext = (file.originalname.split('.').pop() || 'jpg').toLowerCase();
    practitioner.photoUrl = await this.storage.uploadBuffer(
      `clinics/${clinicId}/practitioners/${id}-${Date.now()}.${ext}`,
      file.buffer,
      file.mimetype,
    );
    await this.practitionerRepository.save(practitioner);
    void this.auditLogService.record({
      clinicId, actorId: user.userId, actorName: user.name ?? user.email, actorRole: user.role,
      actionType: AuditActionType.UPDATE, entityType: 'Practitioner', entityId: id,
      entityLabel: `Foto profil ${practitioner.name}`, status: AuditStatus.SUCCESS,
      ipAddress: req.ip, userAgent: req.headers?.['user-agent'],
    });
    return { success: true, data: { id, photoUrl: practitioner.photoUrl } };
  }

  // ----- helpers -----

  /** Owners act on their own clinic; Super Admins must say which clinic. */
  private scope(user: any, clinicId?: number): number {
    if (user.role === UserRole.SUPER_ADMIN) {
      if (!clinicId) throw new BadRequestException('Super Admin wajib menyertakan clinicId');
      return clinicId;
    }
    if (!user.clinicId) throw new ForbiddenException('Akun belum terhubung ke klinik');
    return user.clinicId;
  }

  private async findPractitioner(id: number, clinicId: number) {
    const p = await this.practitionerRepository.findOne({ where: { id, clinicId } });
    if (!p) throw new NotFoundException('Dokter tidak ditemukan di klinik ini');
    return p;
  }

  private validSchedule(schedule: Record<string, string> | null): Record<string, string> | null {
    if (schedule === null) return null;
    const out: Record<string, string> = {};
    for (const [day, hours] of Object.entries(schedule)) {
      if (!DAY_KEYS.includes(day)) throw new BadRequestException(`Hari tidak dikenal: ${day}`);
      const value = String(hours).trim();
      if (!HOURS_PATTERN.test(value)) {
        throw new BadRequestException(`Jam praktik ${day} harus "HH:MM-HH:MM" atau "Tutup"`);
      }
      out[day] = /^tutup$/i.test(value) ? 'Tutup' : value;
    }
    return out;
  }

  private audit(user: any, clinicId: number, req: any, actionType: AuditActionType, apiKey: ApiKey, label: string) {
    // Never the key or its hash — only what identifies it.
    void this.auditLogService.record({
      clinicId, actorId: user.userId, actorName: user.name ?? user.email, actorRole: user.role,
      actionType, entityType: 'ApiKey', entityId: apiKey.id, entityLabel: label,
      afterValue: { keyPrefix: apiKey.keyPrefix, type: apiKey.type, allowedOrigins: apiKey.allowedOrigins ?? [] },
      status: AuditStatus.SUCCESS, ipAddress: req.ip, userAgent: req.headers?.['user-agent'],
    });
  }
}
