import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EncounterSoapNotesService } from './encounter-soap-notes.service';
import { UpsertEncounterSoapNoteDto } from './dto/encounter-soap-note.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('encounters')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('encounters/:encounterId/soap-note')
export class EncounterSoapNotesController {
  constructor(
    private readonly encounterSoapNotesService: EncounterSoapNotesService,
  ) {}

  @Get()
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
  @ApiOperation({ summary: 'Create or update SOAP note for an encounter' })
  async upsert(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpsertEncounterSoapNoteDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.encounterSoapNotesService.upsertForEncounter(
      encounterId,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }
}
