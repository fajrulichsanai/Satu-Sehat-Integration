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
import { VitalSignsService } from './vital-signs.service';
import { UpsertVitalSignsDto } from './dto/vital-signs.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('encounters')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('encounters/:encounterId/vital-signs')
export class VitalSignsController {
  constructor(private readonly vitalSignsService: VitalSignsService) {}

  @Get()
  @ApiOperation({ summary: 'Get vital signs for encounter' })
  async findAll(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.vitalSignsService.findByEncounter(encounterId, clinicId);
    return { success: true, data };
  }

  @Put()
  @ApiOperation({ summary: 'Upsert vital signs for encounter' })
  async upsert(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpsertVitalSignsDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.vitalSignsService.upsert(encounterId, clinicId, dto, user.userId);
    return { success: true, ...result };
  }
}
