import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
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
import { RequireFeature } from '../features/require-feature.decorator';
import { ClinicalRecordsService } from './clinical-records.service';
import type { Actor } from './clinical-records.service';
import {
  CreateConditionDto,
  CreateObservationDto,
  UpdateConditionDto,
  UpdateObservationDto,
} from './dto/clinical-records.dto';

@ApiTags('clinical-records')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@RequireFeature('kunjungan')
@Controller()
export class ClinicalRecordsController {
  constructor(private readonly service: ClinicalRecordsService) {}

  @Get('clinical-records/options')
  @ApiOperation({ summary: 'Pilihan status kondisi & katalog observasi' })
  options() {
    return { success: true, data: this.service.options() };
  }

  @Get('encounters/:encounterId/clinical-records')
  @Audit('MedicalRecord', AuditActionType.VIEW)
  @ApiOperation({
    summary: 'Daftar masalah pasien + observasi tambahan kunjungan ini',
  })
  async forEncounter(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: Actor,
  ) {
    return {
      success: true,
      data: await this.service.forEncounter(encounterId, clinicId, user),
    };
  }

  @Get('patients/:patientId/clinical-records')
  @Audit('MedicalRecord', AuditActionType.VIEW)
  @ApiOperation({ summary: 'Daftar masalah & riwayat observasi pasien' })
  async forPatient(
    @Param('patientId', ParseIntPipe) patientId: number,
    @ClinicId() clinicId: number,
  ) {
    return {
      success: true,
      data: await this.service.forPatient(patientId, clinicId),
    };
  }

  @Post('encounters/:encounterId/conditions')
  @Audit('MedicalRecord', AuditActionType.CREATE)
  @ApiOperation({ summary: 'Tambah kondisi ke daftar masalah pasien' })
  async createCondition(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: CreateConditionDto,
    @CurrentUser() user: Actor,
  ) {
    return {
      success: true,
      data: await this.service.createCondition(
        encounterId,
        clinicId,
        dto,
        user,
      ),
    };
  }

  @Patch('encounters/:encounterId/conditions/:id')
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Ubah status / detail kondisi' })
  async updateCondition(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateConditionDto,
    @CurrentUser() user: Actor,
  ) {
    return {
      success: true,
      data: await this.service.updateCondition(
        encounterId,
        clinicId,
        id,
        dto,
        user,
      ),
    };
  }

  @Delete('encounters/:encounterId/conditions/:id')
  @Audit('MedicalRecord', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Hapus kondisi (salah input)' })
  async removeCondition(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: Actor,
  ) {
    return {
      success: true,
      data: await this.service.removeCondition(encounterId, clinicId, id, user),
    };
  }

  @Post('encounters/:encounterId/observations')
  @Audit('MedicalRecord', AuditActionType.CREATE)
  @ApiOperation({ summary: 'Tambah observasi tambahan' })
  async createObservation(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: CreateObservationDto,
    @CurrentUser() user: Actor,
  ) {
    return {
      success: true,
      data: await this.service.createObservation(
        encounterId,
        clinicId,
        dto,
        user,
      ),
    };
  }

  @Patch('encounters/:encounterId/observations/:id')
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Ubah observasi' })
  async updateObservation(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateObservationDto,
    @CurrentUser() user: Actor,
  ) {
    return {
      success: true,
      data: await this.service.updateObservation(
        encounterId,
        clinicId,
        id,
        dto,
        user,
      ),
    };
  }

  @Delete('encounters/:encounterId/observations/:id')
  @Audit('MedicalRecord', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Hapus observasi (salah input)' })
  async removeObservation(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: Actor,
  ) {
    return {
      success: true,
      data: await this.service.removeObservation(
        encounterId,
        clinicId,
        id,
        user,
      ),
    };
  }

  @Post('encounters/:encounterId/clinical-records/send')
  @RequireFeature('satusehat')
  @ApiOperation({
    summary:
      'Kirim (ulang) kunjungan ke SATUSEHAT, termasuk kondisi & observasi',
  })
  async send(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: Actor,
  ) {
    return {
      success: true,
      data: await this.service.send(encounterId, clinicId, user),
    };
  }
}
