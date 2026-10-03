import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import {
  CreateReservationDto,
  LinkPatientDto,
  RescheduleReservationDto,
  ReservationQueryDto,
  UpdateReservationStatusDto,
} from './dto/reservation.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('reservations')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @ApiOperation({ summary: 'List reservasi (dashboard)' })
  async findAll(
    @ClinicId() clinicId: number,
    @Query() query: ReservationQueryDto,
  ) {
    const result = await this.reservationsService.findAll(clinicId, query);
    return { success: true, data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail reservasi' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.reservationsService.findOne(id, clinicId);
    return { success: true, data };
  }

  @Post()
  @Audit('Appointment', AuditActionType.CREATE)
  @ApiOperation({ summary: 'Buat reservasi manual (telepon/dashboard)' })
  async create(
    @ClinicId() clinicId: number,
    @Body() dto: CreateReservationDto,
  ) {
    const data = await this.reservationsService.create(clinicId, dto);
    return { success: true, message: 'Reservasi berhasil dibuat', data };
  }

  @Patch(':id/status')
  @Audit('Appointment', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Ubah status reservasi (konfirmasi/batal/selesai)' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateReservationStatusDto,
  ) {
    const data = await this.reservationsService.updateStatus(id, clinicId, dto);
    return {
      success: true,
      message: 'Status reservasi berhasil diperbarui',
      data,
    };
  }

  @Patch(':id/reschedule')
  @Audit('Appointment', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Ubah jadwal (tanggal/jam) reservasi' })
  async reschedule(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: RescheduleReservationDto,
  ) {
    const data = await this.reservationsService.reschedule(id, clinicId, dto);
    return {
      success: true,
      message: 'Jadwal reservasi berhasil diubah',
      data,
    };
  }

  @Patch(':id/patient')
  @Audit('Appointment', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Hubungkan pasien yang baru didaftarkan ke reservasi' })
  async linkPatient(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: LinkPatientDto,
  ) {
    const data = await this.reservationsService.linkPatient(id, clinicId, dto);
    return {
      success: true,
      message: 'Pasien berhasil dihubungkan ke reservasi',
      data,
    };
  }

  @Delete(':id')
  @Audit('Appointment', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Hapus reservasi' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Req() req: any,
  ) {
    req.auditBefore = await this.reservationsService.findOne(id, clinicId).catch(() => null);
    await this.reservationsService.remove(id, clinicId);
    return { success: true, message: 'Reservasi berhasil dihapus' };
  }
}
