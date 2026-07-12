import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import {
  CreateReservationDto,
  ReservationQueryDto,
  UpdateReservationStatusDto,
} from './dto/reservation.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';

@ApiTags('reservations')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @ApiOperation({ summary: 'List reservasi (dashboard)' })
  async findAll(
    @ClinicId() clinicId: number,
    @Query() query: ReservationQueryDto,
  ) {
    const result = await this.reservationsService.findAll(clinicId, query);
    return { success: true, data: result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail reservasi' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.reservationsService.findOne(id, clinicId);
    return { success: true, data };
  }

  @Post()
  @ApiOperation({ summary: 'Buat reservasi manual (telepon/dashboard)' })
  async create(
    @ClinicId() clinicId: number,
    @Body() dto: CreateReservationDto,
  ) {
    const data = await this.reservationsService.create(clinicId, dto);
    return { success: true, message: 'Reservasi berhasil dibuat', data };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Ubah status reservasi (konfirmasi/batal/selesai)' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateReservationStatusDto,
  ) {
    const data = await this.reservationsService.updateStatus(id, clinicId, dto);
    return {
      success: true,
      message: 'Status reservasi berhasil diperbarui',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hapus reservasi' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    await this.reservationsService.remove(id, clinicId);
    return { success: true, message: 'Reservasi berhasil dihapus' };
  }
}
