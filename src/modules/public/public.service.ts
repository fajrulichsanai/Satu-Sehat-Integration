import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { ReservationsService } from '../reservations/reservations.service';
import {
  PublicAvailableSlotsQueryDto,
  PublicCreateReservationDto,
  PublicReservationStatusQueryDto,
} from '../reservations/dto/reservation.dto';

const DAY_KEYS = [
  'minggu',
  'senin',
  'selasa',
  'rabu',
  'kamis',
  'jumat',
  'sabtu',
];

const SLOT_INTERVAL_MINUTES = 30;

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

  async getAvailableSlots(query: PublicAvailableSlotsQueryDto) {
    const clinic = await this.clinicRepository.findOne({
      where: { id: query.clinicId, setupComplete: true },
      select: { id: true, operationalHours: true },
    });
    if (!clinic) {
      throw new NotFoundException('Klinik tidak ditemukan atau belum aktif');
    }

    const dayKey = DAY_KEYS[new Date(`${query.date}T00:00:00`).getDay()];
    const hoursToday = clinic.operationalHours?.[dayKey];

    if (!hoursToday || hoursToday === 'Tutup') {
      return { date: query.date, isOpen: false, slots: [] };
    }

    const [openTime, closeTime] = hoursToday.split('-');
    const allSlots = this.generateSlots(openTime, closeTime);

    const bookedSlots = await this.reservationsService.getBookedSlots(
      query.clinicId,
      query.date,
      query.practitionerId,
    );

    return {
      date: query.date,
      isOpen: true,
      slots: allSlots.filter((slot) => !bookedSlots.includes(slot)),
    };
  }

  private generateSlots(openTime: string, closeTime: string): string[] {
    const toMinutes = (time: string) => {
      const [hour, minute] = time.split(':').map(Number);
      return hour * 60 + minute;
    };
    const toTimeString = (minutes: number) => {
      const hour = Math.floor(minutes / 60)
        .toString()
        .padStart(2, '0');
      const minute = (minutes % 60).toString().padStart(2, '0');
      return `${hour}:${minute}`;
    };

    const slots: string[] = [];
    for (
      let minutes = toMinutes(openTime);
      minutes < toMinutes(closeTime);
      minutes += SLOT_INTERVAL_MINUTES
    ) {
      slots.push(toTimeString(minutes));
    }
    return slots;
  }
}
