import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard, ClinicContextGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';
import { ApiResponse } from '../../common/response/api-response';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { RequireFeature } from '../features/require-feature.decorator';
import { AttendanceService, type Actor } from './attendance.service';
import { AttendanceConfigService } from './attendance-config.service';
import { SELFIE_MAX_BYTES } from './selfie-check';
import {
  ClinicDeviceDto,
  ClockDto,
  CorrectionDto,
  MonthQueryDto,
  SettingsDto,
  UserScheduleDto,
  WeekScheduleDto,
} from './dto/attendance.dto';

/** Foto selfie hanya dibaca di memori, tidak pernah ditulis ke disk */
const selfieUpload = FileInterceptor('photo', {
  storage: memoryStorage(),
  limits: { fileSize: SELFIE_MAX_BYTES, files: 1 },
});

const STAFF = [UserRole.ADMIN, UserRole.DOKTER, UserRole.PERAWAT];
const VIEWERS = [UserRole.OWNER, UserRole.ADMIN];

@ApiTags('attendance')
@ApiBearerAuth('JWT-auth')
@RequireFeature('absensi')
@UseGuards(JwtAuthGuard, RolesGuard, ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendance: AttendanceService,
    private readonly config: AttendanceConfigService,
  ) {}

  // ── Pegawai ──

  @Get('me/today')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Jadwal & absen saya hari ini' })
  async myToday(
    @CurrentUser() user: Actor,
    @ClinicId() clinicId: number,
    @Headers('x-device-token') deviceToken?: string,
  ) {
    return ApiResponse.success(
      await this.attendance.todayForMe({ ...user, clinicId }, deviceToken),
    );
  }

  @Get('me')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Riwayat absen saya per bulan' })
  async myMonth(
    @CurrentUser() user: Actor,
    @ClinicId() clinicId: number,
    @Query() query: MonthQueryDto,
  ) {
    return ApiResponse.success(
      await this.attendance.myMonth({ ...user, clinicId }, query.month),
    );
  }

  @Post('clock-in')
  @Roles(...STAFF)
  @UseInterceptors(selfieUpload)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Absen masuk (selfie + lokasi)' })
  async clockIn(
    @CurrentUser() user: Actor,
    @ClinicId() clinicId: number,
    @Body() dto: ClockDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return ApiResponse.success(
      await this.attendance.clock('in', { ...user, clinicId }, dto, photo),
      'Absen masuk tercatat',
    );
  }

  @Post('clock-out')
  @Roles(...STAFF)
  @UseInterceptors(selfieUpload)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Absen pulang (selfie + lokasi)' })
  async clockOut(
    @CurrentUser() user: Actor,
    @ClinicId() clinicId: number,
    @Body() dto: ClockDto,
    @UploadedFile() photo?: Express.Multer.File,
  ) {
    return ApiResponse.success(
      await this.attendance.clock('out', { ...user, clinicId }, dto, photo),
      'Absen pulang tercatat',
    );
  }

  // ── Owner / admin: kehadiran ──

  @Get('today')
  @Roles(...VIEWERS)
  @ApiOperation({ summary: 'Kehadiran semua pegawai hari ini' })
  async today(@ClinicId() clinicId: number) {
    return ApiResponse.success(await this.attendance.todayBoard(clinicId));
  }

  @Get('recap')
  @Roles(...VIEWERS)
  @ApiOperation({ summary: 'Rekap kehadiran per pegawai dalam satu bulan' })
  async recap(@ClinicId() clinicId: number, @Query() query: MonthQueryDto) {
    return ApiResponse.success(
      await this.attendance.recap(clinicId, query.month),
    );
  }

  @Get('recap/:userId')
  @Roles(...VIEWERS)
  @ApiOperation({ summary: 'Rincian kehadiran harian seorang pegawai' })
  async recapUser(
    @ClinicId() clinicId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: MonthQueryDto,
  ) {
    return ApiResponse.success(
      await this.attendance.userMonth(clinicId, userId, query.month),
    );
  }

  @Put('correction')
  @Roles(...VIEWERS)
  @Audit('Attendance', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Koreksi jam absen (alasan wajib)' })
  async correct(
    @CurrentUser() user: Actor,
    @ClinicId() clinicId: number,
    @Body() dto: CorrectionDto,
    @Req() req: { auditEntityLabel?: string },
  ) {
    req.auditEntityLabel = `Koreksi absen ${dto.workDate}: ${dto.reason.slice(0, 80)}`;
    return ApiResponse.success(
      await this.attendance.correct(clinicId, { ...user, clinicId }, dto),
      'Absen dikoreksi',
    );
  }

  // ── Owner / admin: pengaturan ──

  @Get('settings')
  @Roles(...VIEWERS)
  @ApiOperation({ summary: 'Toleransi terlambat, radius, titik klinik' })
  async settings(@ClinicId() clinicId: number) {
    return ApiResponse.success(await this.config.settings(clinicId));
  }

  @Put('settings')
  @Roles(UserRole.OWNER)
  @Audit('AttendanceSetting', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Ubah pengaturan absensi klinik' })
  async saveSettings(
    @CurrentUser() user: Actor,
    @ClinicId() clinicId: number,
    @Body() dto: SettingsDto,
  ) {
    return ApiResponse.success(
      await this.config.saveSettings(clinicId, dto, user.userId),
    );
  }

  @Get('schedules')
  @Roles(...VIEWERS)
  @ApiOperation({
    summary: 'Jadwal kerja bawaan klinik & jadwal khusus pegawai',
  })
  async schedules(@ClinicId() clinicId: number) {
    return ApiResponse.success(await this.config.schedules(clinicId));
  }

  @Put('schedules/clinic')
  @Roles(UserRole.OWNER)
  @Audit('WorkSchedule', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Ubah jadwal kerja bawaan klinik' })
  async saveClinicSchedule(
    @CurrentUser() user: Actor,
    @ClinicId() clinicId: number,
    @Body() dto: WeekScheduleDto,
  ) {
    return ApiResponse.success(
      await this.config.saveClinicSchedule(clinicId, dto.days, user.userId),
    );
  }

  @Put('schedules/users/:userId')
  @Roles(UserRole.OWNER)
  @Audit('WorkSchedule', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Jadwal khusus pegawai (null = ikut bawaan)' })
  async saveUserSchedule(
    @CurrentUser() user: Actor,
    @ClinicId() clinicId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UserScheduleDto,
  ) {
    return ApiResponse.success(
      await this.config.saveUserSchedule(
        clinicId,
        userId,
        dto.days,
        user.userId,
      ),
    );
  }

  @Get('devices')
  @Roles(...VIEWERS)
  @ApiOperation({ summary: 'Perangkat absen pegawai & perangkat klinik' })
  async devices(@ClinicId() clinicId: number) {
    return ApiResponse.success(await this.config.devices(clinicId));
  }

  @Post('devices/clinic')
  @Roles(UserRole.OWNER)
  @Audit('AttendanceDevice', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Jadikan perangkat ini perangkat klinik' })
  async markClinicDevice(
    @CurrentUser() user: Actor,
    @ClinicId() clinicId: number,
    @Body() dto: ClinicDeviceDto,
  ) {
    return ApiResponse.success(
      await this.config.markClinicDevice(
        clinicId,
        dto.deviceToken,
        dto.deviceName,
        user.userId,
      ),
    );
  }

  @Post('devices/:id/register')
  @Roles(UserRole.OWNER)
  @Audit('AttendanceDevice', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Daftarkan perangkat baru seorang pegawai' })
  async registerDevice(
    @CurrentUser() user: Actor,
    @ClinicId() clinicId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return ApiResponse.success(
      await this.config.registerDevice(clinicId, id, user.userId),
    );
  }

  @Delete('devices/:id')
  @Roles(UserRole.OWNER)
  @Audit('AttendanceDevice', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Hapus perangkat absen' })
  async removeDevice(
    @ClinicId() clinicId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return ApiResponse.success(await this.config.removeDevice(clinicId, id));
  }
}
