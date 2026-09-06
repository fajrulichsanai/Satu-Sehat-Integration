import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DentalExaminationService } from './dental-examination.service';
import { UpsertDentalExaminationDto } from './dto/dental-examination.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('encounters')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller('encounters/:encounterId/dental-examination')
export class DentalExaminationController {
  constructor(
    private readonly dentalExaminationService: DentalExaminationService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get advanced dental examination (indices) for an encounter',
  })
  async findOne(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.dentalExaminationService.findByEncounter(
      encounterId,
      clinicId,
    );
    return { success: true, data };
  }

  @Put()
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({
    summary: 'Create or update advanced dental examination for an encounter',
  })
  async upsert(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpsertDentalExaminationDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    req.auditBefore = await this.dentalExaminationService
      .findByEncounter(encounterId, clinicId)
      .catch(() => null);
    const data = await this.dentalExaminationService.upsertForEncounter(
      encounterId,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }
}
