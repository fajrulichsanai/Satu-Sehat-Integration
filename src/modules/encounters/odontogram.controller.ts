import { Body, Controller, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OdontogramService } from './odontogram.service';
import { UpsertOdontogramDto } from './dto/odontogram.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('encounters')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('encounters/:encounterId/odontogram')
export class OdontogramController {
  constructor(private readonly odontogramService: OdontogramService) {}

  @Get()
  @ApiOperation({ summary: 'Get odontogram for encounter' })
  async findOne(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.odontogramService.findByEncounter(encounterId, clinicId);
    return { success: true, data };
  }

  @Put()
  @ApiOperation({ summary: 'Upsert odontogram (DMF-T calculated automatically)' })
  async upsert(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpsertOdontogramDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.odontogramService.upsert(encounterId, clinicId, dto, user.userId);
    return { success: true, data };
  }
}
