import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicService } from './public.service';
import {
  PublicAvailableSlotsQueryDto,
  PublicCreateReservationDto,
  PublicReservationStatusQueryDto,
} from '../reservations/dto/reservation.dto';
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
  @ApiOperation({ summary: 'Get available reservation slots' })
  async getAvailableSlots(@Query() query: PublicAvailableSlotsQueryDto) {
    const data = await this.publicService.getAvailableSlots(query);
    return { success: true, data };
  }

  @Post('reservations')
  @ApiOperation({ summary: 'Create reservation from landing page' })
  async createReservation(@Body() dto: PublicCreateReservationDto) {
    const data = await this.publicService.createReservation(dto);
    return {
      success: true,
      message:
        'Reservasi berhasil dibuat, silakan tunggu konfirmasi dari klinik',
      data,
    };
  }

  @Get('reservations/status')
  @ApiOperation({ summary: 'Check reservation status by token' })
  async getReservationStatus(@Query() query: PublicReservationStatusQueryDto) {
    const data = await this.publicService.getReservationStatus(query);
    return { success: true, data };
  }
}
