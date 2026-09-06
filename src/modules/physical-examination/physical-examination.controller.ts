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
import { PhysicalExaminationService } from './physical-examination.service';
import { UpsertPhysicalExaminationDto } from './dto/physical-examination.dto';
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
@Controller('encounters/:encounterId/physical-examination')
export class PhysicalExaminationController {
  constructor(
    private readonly physicalExaminationService: PhysicalExaminationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get physical examination for an encounter' })
  async findOne(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.physicalExaminationService.findByEncounter(
      encounterId,
      clinicId,
    );
    return { success: true, data };
  }

  @Put()
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Create or update physical examination for an encounter' })
  async upsert(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpsertPhysicalExaminationDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    req.auditBefore = await this.physicalExaminationService
      .findByEncounter(encounterId, clinicId)
      .catch(() => null);
    const data = await this.physicalExaminationService.upsertForEncounter(
      encounterId,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }
}
