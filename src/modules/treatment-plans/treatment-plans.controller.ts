import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TreatmentPlansService } from './treatment-plans.service';
import {
  CreateTreatmentPlanDto,
  CreateTreatmentPlanSessionDto,
  UpdateTreatmentPlanDto,
  UpdateTreatmentPlanSessionDto,
} from './dto/treatment-plan.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('treatment-plans')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('treatment-plans')
export class TreatmentPlansController {
  constructor(private readonly treatmentPlansService: TreatmentPlansService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new treatment plan for a patient' })
  async create(
    @ClinicId() clinicId: number,
    @Body() dto: CreateTreatmentPlanDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.treatmentPlansService.create(
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get treatment plan detail' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.treatmentPlansService.findOne(id, clinicId);
    return { success: true, data };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update treatment plan' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateTreatmentPlanDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.treatmentPlansService.update(
      id,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Get(':id/sessions')
  @ApiOperation({ summary: 'List sessions/stages for a treatment plan' })
  async findSessions(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.treatmentPlansService.findSessions(id, clinicId);
    return { success: true, data };
  }

  @Post(':id/sessions')
  @ApiOperation({ summary: 'Add a session/stage to a treatment plan' })
  async addSession(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: CreateTreatmentPlanSessionDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.treatmentPlansService.addSession(
      id,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Patch(':id/sessions/:sessionId')
  @ApiOperation({ summary: 'Update a treatment plan session' })
  async updateSession(
    @Param('id', ParseIntPipe) id: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateTreatmentPlanSessionDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.treatmentPlansService.updateSession(
      sessionId,
      id,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }
}
