import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { ReservationsService } from '../reservations/reservations.service';
import {
  PublicCreateReservationDto,
  PublicReservationStatusQueryDto,
} from '../reservations/dto/reservation.dto';

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    private readonly reservationsService: ReservationsService,
  ) {}

  async getClinicInfo(clinicId: number) {
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId, setupComplete: true },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        province: true,
        phone: true,
        email: true,
        operationalHours: true,
      },
    });
    if (!clinic) {
      throw new NotFoundException('Klinik tidak ditemukan atau belum aktif');
    }
    return clinic;
  }

  async createReservation(dto: PublicCreateReservationDto) {
    const reservation = await this.reservationsService.createPublic(dto);
    return {
      token: reservation.token,
      reservationDate: reservation.reservationDate,
      jamSlot: reservation.jamSlot,
      patientName: reservation.patientName,
      status: reservation.status,
    };
  }

  async getReservationStatus(query: PublicReservationStatusQueryDto) {
    return this.reservationsService.getStatusByToken(query.token);
  }
}
