import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { IsInt, IsString, Max, Min } from 'class-validator';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../enums';
import { SkipSubscriptionCheck } from '../subscriptions/guards/subscription.guard';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AuditActionType,
  AuditStatus,
} from '../audit-log/entities/audit-log.entity';
import { ClinicDataExportService } from './clinic-data-export.service';
import { DataRetentionService } from './data-retention.service';

class PostponeDto {
  @IsInt()
  @Min(1)
  @Max(90)
  days: number;
}

class PurgeDto {
  @IsString()
  confirmName: string;
}

/**
 * Unduh semua data klinik (ZIP berisi Excel + berkas) dan jadwal penghapusan
 * data klinik yang berhenti berlangganan. Tetap bisa dipakai setelah
 * langganan habis — justru saat itulah data perlu diunduh.
 */
@ApiTags('Data Retention')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@SkipSubscriptionCheck()
@Controller()
export class DataRetentionController {
  /** One export at a time per clinic: it reads every table and file. */
  private readonly running = new Set<number>();

  constructor(
    private readonly exporter: ClinicDataExportService,
    private readonly retention: DataRetentionService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get('clinic-data/retention')
  @ApiOperation({
    summary: 'Jadwal penghapusan data klinik ini (bila berhenti berlangganan)',
  })
  async status(@CurrentUser() user: any) {
    if (!user.clinicId) throw new BadRequestException('Bukan akun klinik');
    return {
      success: true,
      data: await this.retention.statusFor(user.clinicId),
    };
  }

  @Get('clinic-data/export')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Unduh semua data klinik (ZIP: Excel per jenis data + berkas)',
  })
  async exportMine(
    @CurrentUser() user: any,
    @Req() req: any,
    @Res() res: Response,
  ) {
    await this.stream(user.clinicId, user, req, res);
  }

  @Get('super-admin/clinics/:id/export')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Unduh semua data satu klinik (super admin)' })
  async exportClinic(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: any,
    @Req() req: any,
    @Res() res: Response,
  ) {
    await this.stream(id, user, req, res);
  }

  @Get('super-admin/data-retention')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Klinik yang dijadwalkan atau sudah dihapus datanya',
  })
  async list() {
    return { success: true, data: await this.retention.list() };
  }

  @Post('super-admin/data-retention/:clinicId/postpone')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Tunda penghapusan data klinik' })
  async postpone(
    @Param('clinicId', ParseIntPipe) clinicId: number,
    @Body() dto: PostponeDto,
    @CurrentUser() user: any,
  ) {
    return {
      success: true,
      data: await this.retention.postpone(clinicId, dto.days, user.userId),
    };
  }

  @Post('super-admin/data-retention/:clinicId/purge')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary:
      'Hapus sekarang data klinik yang sudah berhenti berlangganan (ketik nama klinik)',
  })
  async purge(
    @Param('clinicId', ParseIntPipe) clinicId: number,
    @Body() dto: PurgeDto,
    @CurrentUser() user: any,
  ) {
    const rows = await this.retention.list();
    const row = rows.find((r) => r.clinicId === clinicId);
    if (!row) {
      throw new BadRequestException('Klinik ini tidak dijadwalkan dihapus');
    }
    if (dto.confirmName.trim() !== row.clinicName.trim()) {
      throw new BadRequestException('Nama klinik tidak cocok');
    }
    return {
      success: true,
      data: await this.retention.purge(clinicId, user.userId, { force: true }),
    };
  }

  private async stream(clinicId: number, user: any, req: any, res: Response) {
    if (!clinicId) throw new BadRequestException('Bukan akun klinik');
    if (this.running.has(clinicId)) {
      throw new HttpException(
        'Ekspor data klinik ini sedang berjalan. Tunggu sampai selesai.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.running.add(clinicId);
    try {
      const { fileName, zip } = await this.exporter.build(clinicId);
      void this.auditLog.record({
        clinicId,
        actorId: user.userId,
        actorName: user.name ?? user.email,
        actorRole: user.role,
        actionType: AuditActionType.EXPORT,
        entityType: 'ClinicData',
        entityId: clinicId,
        entityLabel: 'Unduh semua data klinik',
        status: AuditStatus.SUCCESS,
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );
      res.setHeader('Cache-Control', 'no-store');
      await new Promise<void>((resolve, reject) => {
        zip
          .generateNodeStream({
            type: 'nodebuffer',
            streamFiles: true,
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
          })
          .on('error', reject)
          .pipe(res)
          .on('finish', () => resolve())
          .on('error', reject);
      });
    } finally {
      this.running.delete(clinicId);
    }
  }
}
