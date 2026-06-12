import { Controller, Get, Post, Body, Query, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicService } from './public.service';
import {
  AvailableSlotsQueryDto,
  BookingDto,
  QueueStatusQueryDto,
} from './dto/public.dto';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('public')
@Public()
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('clinic-info')
  @ApiOperation({ summary: 'Get clinic public info' })
  async getClinicInfo(@Query('clinicId', ParseIntPipe) clinicId: number) {
    const data = await this.publicService.getClinicInfo(clinicId);
    return { success: true, data };
  }

  @Get('available-slots')
  @ApiOperation({ summary: 'Get available booking slots' })
  async getAvailableSlots(@Query() query: AvailableSlotsQueryDto) {
    const data = await this.publicService.getAvailableSlots(query);
    return { success: true, data };
  }

  @Post('book')
  @ApiOperation({ summary: 'Create online booking' })
  async book(@Body() dto: BookingDto) {
    const data = await this.publicService.book(dto);
    return { success: true, message: 'Booking berhasil dibuat', data };
  }

  @Get('queue-status')
  @ApiOperation({ summary: 'Check queue status by token' })
  async getQueueStatus(@Query() query: QueueStatusQueryDto) {
    const data = await this.publicService.getQueueStatus(query);
    return { success: true, data };
  }
}
