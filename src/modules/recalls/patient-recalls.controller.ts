import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PatientRecallsService } from './patient-recalls.service';
import {
  PatientRecallQueryDto,
  UpdatePatientRecallDto,
} from './dto/patient-recall.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('recalls')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller('patient-recalls')
export class PatientRecallsController {
  constructor(private readonly patientRecallsService: PatientRecallsService) {}

  @Get()
  @ApiOperation({
    summary: 'Daftar recall pasien (dashboard), urut jatuh tempo paling lama',
  })
  async findAll(
    @Query() query: PatientRecallQueryDto,
    @ClinicId() clinicId: number,
  ) {
    const result = await this.patientRecallsService.findAll(clinicId, query);
    return { success: true, data: result };
  }

  @Patch(':id')
  @Audit('PatientRecall', AuditActionType.UPDATE)
  @ApiOperation({
    summary:
      'Update status recall (sudah dihubungi/booking ulang) atau override tanggal',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdatePatientRecallDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.patientRecallsService.update(
      id,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }
}
