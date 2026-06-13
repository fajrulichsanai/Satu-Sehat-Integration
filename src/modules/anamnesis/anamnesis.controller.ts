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
import { AnamnesisService } from './anamnesis.service';
import { UpsertAnamnesisDto } from '../encounters/dto/anamnesis.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('encounters')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('encounters/:encounterId/anamnesis')
export class AnamnesisController {
  constructor(private readonly anamnesisService: AnamnesisService) {}

  @Get()
  @ApiOperation({ summary: 'Get anamnesis for encounter' })
  async findOne(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.anamnesisService.findByEncounter(encounterId, clinicId);
    return { success: true, data };
  }

  @Put()
  @ApiOperation({ summary: 'Upsert anamnesis (including allergies & medication history)' })
  async upsert(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpsertAnamnesisDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.anamnesisService.upsert(encounterId, clinicId, dto, user.userId);
    return { success: true, data };
  }
}
