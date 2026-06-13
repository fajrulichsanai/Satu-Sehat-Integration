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
import { OhisService } from './ohis.service';
import { UpsertOhisDto } from './dto/ohis.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('encounters')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('encounters/:encounterId/ohis')
export class OhisController {
  constructor(private readonly ohisService: OhisService) {}

  @Get()
  @ApiOperation({ summary: 'Get OHI-S scores for encounter' })
  async findOne(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.ohisService.findByEncounter(encounterId, clinicId);
    return { success: true, data };
  }

  @Put()
  @ApiOperation({
    summary: 'Upsert OHI-S scores (DI-S, CI-S, OHI-S calculated automatically)',
  })
  async upsert(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpsertOhisDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.ohisService.upsert(
      encounterId,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }
}
