import {
  Body,
  Controller,
  Delete,
  Get,
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
import { RequireFeature } from '../features/require-feature.decorator';
import { ImmunizationsService } from './immunizations.service';
import { CreateImmunizationDto } from './dto/immunization.dto';

@ApiTags('immunizations')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@RequireFeature('imunisasi')
@Controller()
export class ImmunizationsController {
  constructor(private readonly service: ImmunizationsService) {}

  @Get('immunizations/options')
  @ApiOperation({ summary: 'Pilihan rute & lokasi suntik' })
  options() {
    return { success: true, data: this.service.options() };
  }

  @Get('encounters/:encounterId/immunizations')
  @Audit('MedicalRecord', AuditActionType.VIEW)
  @ApiOperation({ summary: 'Imunisasi di kunjungan ini' })
  async list(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    return {
      success: true,
      data: await this.service.list(encounterId, clinicId),
    };
  }

  @Get('patients/:patientId/immunizations')
  @Audit('MedicalRecord', AuditActionType.VIEW)
  @ApiOperation({ summary: 'Riwayat imunisasi pasien' })
  async history(
    @Param('patientId', ParseIntPipe) patientId: number,
    @ClinicId() clinicId: number,
  ) {
    return {
      success: true,
      data: await this.service.history(patientId, clinicId),
    };
  }

  @Post('encounters/:encounterId/immunizations')
  @Audit('MedicalRecord', AuditActionType.CREATE)
  @ApiOperation({ summary: 'Catat imunisasi/vaksin yang diberikan' })
  async create(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: CreateImmunizationDto,
    @CurrentUser() user: { userId: number },
  ) {
    return {
      success: true,
      data: await this.service.create(encounterId, clinicId, dto, user.userId),
    };
  }

  @Delete('encounters/:encounterId/immunizations/:id')
  @Audit('MedicalRecord', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Hapus catatan imunisasi (salah input)' })
  async remove(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: { userId: number },
  ) {
    return {
      success: true,
      data: await this.service.remove(encounterId, clinicId, id, user.userId),
    };
  }
}
