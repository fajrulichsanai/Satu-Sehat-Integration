import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QueuesService } from './queues.service';
import {
  CreateQueueDto,
  QueueQueryDto,
  SlotsQueryDto,
  UpdateQueueStatusDto,
} from './dto/queue.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('queues')
@ApiBearerAuth('JWT-auth')
@Controller('queues')
export class QueuesController {
  constructor(private readonly queuesService: QueuesService) {}

  @Get()
  @UseGuards(ClinicContextGuard)
  @ApiOperation({ summary: 'List queues (default: today)' })
  async findAll(@ClinicId() clinicId: number, @Query() query: QueueQueryDto) {
    const result = await this.queuesService.findAll(clinicId, query);
    return { success: true, ...result };
  }

  @Post()
  @UseGuards(ClinicContextGuard)
  @ApiOperation({ summary: 'Create walk-in queue' })
  async create(@ClinicId() clinicId: number, @Body() dto: CreateQueueDto) {
    const queue = await this.queuesService.create(clinicId, dto);
    return { success: true, message: 'Antrian berhasil dibuat', data: queue };
  }

  @Get('slots')
  @UseGuards(ClinicContextGuard)
  @ApiOperation({ summary: 'Get available time slots for a date' })
  async getSlots(@ClinicId() clinicId: number, @Query() query: SlotsQueryDto) {
    const slots = await this.queuesService.getAvailableSlots(clinicId, query);
    return { success: true, data: slots };
  }

  @Public()
  @Get('monitor')
  @ApiOperation({ summary: 'Waiting room monitor display (no auth)' })
  async getMonitor(@Query('clinicId', ParseIntPipe) clinicId: number) {
    const data = await this.queuesService.getMonitorData(clinicId);
    return { success: true, data };
  }

  @Patch(':id/status')
  @UseGuards(ClinicContextGuard)
  @ApiOperation({ summary: 'Update queue status with transition validation' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateQueueStatusDto,
  ) {
    const queue = await this.queuesService.updateStatus(id, clinicId, dto);
    return {
      success: true,
      message: 'Status antrian berhasil diperbarui',
      data: queue,
    };
  }
}
