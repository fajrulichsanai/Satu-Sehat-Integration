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
import { EncounterSoapNotesService } from './encounter-soap-notes.service';
import { UpsertEncounterSoapNoteDto } from './dto/encounter-soap-note.dto';
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
@Controller('encounters/:encounterId/soap-note')
export class EncounterSoapNotesController {
  constructor(
    private readonly encounterSoapNotesService: EncounterSoapNotesService,
  ) {}

  @Get()
  @Audit('MedicalRecord', AuditActionType.VIEW)
  @ApiOperation({ summary: 'Get SOAP note for an encounter' })
  async findOne(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.encounterSoapNotesService.findByEncounter(
      encounterId,
      clinicId,
    );
    return { success: true, data };
  }

  @Put()
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Create or update SOAP note for an encounter' })
  async upsert(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpsertEncounterSoapNoteDto,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    req.auditBefore = await this.encounterSoapNotesService
      .findByEncounter(encounterId, clinicId)
      .catch(() => null);
    const data = await this.encounterSoapNotesService.upsertForEncounter(
      encounterId,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }
}
