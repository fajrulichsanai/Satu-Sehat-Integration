import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';
import { ReferralsService } from './referrals.service';
import {
  CreateReferralDto,
  SearchCandidatesDto,
  SendReferralDto,
} from './dto/referral.dto';

@ApiTags('referrals')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller()
export class ReferralsController {
  constructor(private readonly service: ReferralsService) {}

  @Get('referrals/options')
  @ApiOperation({
    summary: 'Pilihan kode rujukan (poli tujuan, kelompok layanan, nakes)',
  })
  options() {
    return { success: true, data: this.service.options() };
  }

  @Get('encounters/:encounterId/referrals')
  @Audit('MedicalRecord', AuditActionType.VIEW)
  @ApiOperation({ summary: 'Rujukan dari kunjungan ini' })
  async list(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    return {
      success: true,
      data: await this.service.list(encounterId, clinicId),
    };
  }

  @Get('patients/:patientId/referrals')
  @Audit('MedicalRecord', AuditActionType.VIEW)
  @ApiOperation({ summary: 'Riwayat rujukan pasien' })
  async history(
    @Param('patientId', ParseIntPipe) patientId: number,
    @ClinicId() clinicId: number,
  ) {
    return {
      success: true,
      data: await this.service.history(patientId, clinicId),
    };
  }

  @Post('encounters/:encounterId/referrals')
  @Audit('MedicalRecord', AuditActionType.CREATE)
  @ApiOperation({
    summary: 'Buat rujukan (langsung kirim pra permintaan ke SATUSEHAT)',
  })
  async create(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: CreateReferralDto,
    @CurrentUser() user: any,
  ) {
    return {
      success: true,
      data: await this.service.create(encounterId, clinicId, dto, user.userId),
    };
  }

  @Post('referrals/:id/retry')
  @HttpCode(200)
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Ulangi langkah rujukan yang tertunda' })
  async retry(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    return { success: true, data: await this.service.retry(id, clinicId) };
  }

  @Post('referrals/:id/candidates')
  @HttpCode(200)
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Cari RS rujukan (jawaban kuesioner + wilayah)' })
  async candidates(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: SearchCandidatesDto,
  ) {
    return {
      success: true,
      data: await this.service.searchCandidates(id, clinicId, dto),
    };
  }

  @Post('referrals/:id/send')
  @HttpCode(200)
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Kirim permintaan rujukan ke RS tujuan' })
  async send(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: SendReferralDto,
  ) {
    return { success: true, data: await this.service.send(id, clinicId, dto) };
  }

  @Post('referrals/:id/cancel')
  @HttpCode(200)
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Batalkan rujukan yang belum terkirim' })
  async cancel(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    return { success: true, data: await this.service.cancel(id, clinicId) };
  }
}
