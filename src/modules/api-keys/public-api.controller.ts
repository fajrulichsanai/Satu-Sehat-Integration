import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { ApiKeyGuard } from './api-key.guard';
import { PublicApiService } from './public-api.service';
import { ApiCreateReservationDto, ApiSlotsQueryDto } from './dto/api-key.dto';

type ApiRequest = Request & { apiClinicId: number };

const fileBase = (req: Request) => `${req.protocol}://${req.get('host')}`;

/**
 * Public API for clinic websites and partner systems, authenticated by the
 * clinic's API key (see Pengaturan → API). Limits come from the clinic's
 * plan and are enforced per key by ApiKeyGuard — so the IP-based global
 * throttler is skipped here.
 */
@ApiTags('public-api')
@ApiHeader({ name: 'X-Api-Key', required: true })
@Public()
@SkipThrottle()
@UseGuards(ApiKeyGuard)
@Controller('v1')
export class PublicApiController {
  constructor(private readonly publicApiService: PublicApiService) {}

  @Get('clinic')
  @ApiOperation({ summary: 'Clinic profile and operational hours' })
  async clinic(@Req() req: ApiRequest) {
    return { success: true, data: await this.publicApiService.clinic(req.apiClinicId, fileBase(req)) };
  }

  @Get('practitioners')
  @ApiOperation({ summary: 'Active doctors: name, specialization, photo, practice hours' })
  async practitioners(@Req() req: ApiRequest) {
    return { success: true, data: await this.publicApiService.practitioners(req.apiClinicId, fileBase(req)) };
  }

  @Get('services')
  @ApiOperation({ summary: 'Active services and prices' })
  async services(@Req() req: ApiRequest) {
    return { success: true, data: await this.publicApiService.services(req.apiClinicId) };
  }

  @Get('slots')
  @ApiOperation({ summary: 'Free reservation slots for a date (optionally per doctor)' })
  async slots(@Req() req: ApiRequest, @Query() query: ApiSlotsQueryDto) {
    return { success: true, data: await this.publicApiService.slots(req.apiClinicId, query.date, query.practitionerId) };
  }

  @Post('reservations')
  @ApiOperation({ summary: 'Create a reservation (status pending until the clinic confirms)' })
  async createReservation(@Req() req: ApiRequest, @Body() dto: ApiCreateReservationDto) {
    return { success: true, data: await this.publicApiService.createReservation(req.apiClinicId, dto) };
  }

  @Get('reservations/:token')
  @ApiOperation({ summary: 'Reservation status by token' })
  async reservationStatus(@Req() req: ApiRequest, @Param('token') token: string) {
    return { success: true, data: await this.publicApiService.reservationStatus(req.apiClinicId, token) };
  }

  @Post('reservations/:token/cancel')
  @ApiOperation({ summary: 'Cancel a pending/confirmed reservation by token' })
  async cancelReservation(@Req() req: ApiRequest, @Param('token') token: string) {
    return { success: true, data: await this.publicApiService.cancelReservation(req.apiClinicId, token) };
  }
}
