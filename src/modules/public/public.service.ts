import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Practitioner } from '../practitioners/entities/practitioner.entity';
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

/**
 * The DB connection timezone is fixed at +07:00 (WIB, see data-source
 * config), so "now" for comparing against a date/time-only slot must be
 * computed on that same offset — the server this runs on may be in UTC,
 * which would make every slot in the morning look "already past" to a
 * naive `new Date()` comparison.
 */
function nowInClinicTimezone(): { date: string; time: string } {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString();
  return { date: wib.slice(0, 10), time: wib.slice(11, 16) };
}

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(Practitioner)
    private readonly practitionerRepository: Repository<Practitioner>,
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

    const practitioners = await this.practitionerRepository.find({
      where: { clinicId, isActive: true },
      select: { id: true, name: true, specialization: true },
      order: { id: 'ASC' },
    });

    return { ...clinic, practitioners };
  }

  async createReservation(dto: PublicCreateReservationDto) {
    const reservation = await this.reservationsService.createPublic(dto);
    return {
      token: reservation.token,
      reservationDate: reservation.reservationDate,
      jamSlot: reservation.jamSlot,
      patientName: reservation.patientName,
      practitionerId: reservation.practitionerId,
      status: reservation.status,
    };
  }

  async getReservationStatus(query: PublicReservationStatusQueryDto) {
    const reservation = await this.reservationsService.getStatusByToken(
      query.token,
    );
    return {
      token: reservation.token,
      patientName: reservation.patientName,
      reservationDate: reservation.reservationDate,
      jamSlot: reservation.jamSlot,
      status: reservation.status,
      practitionerId: reservation.practitionerId,
      practitionerName: reservation.practitioner?.name ?? null,
    };
  }

  async cancelReservation(token: string) {
    const reservation = await this.reservationsService.cancelByToken(token);
    return {
      token: reservation.token,
      status: reservation.status,
    };
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

    let slots = allSlots.filter((slot) => !bookedSlots.includes(slot));

    const { date: todayWib, time: nowWib } = nowInClinicTimezone();
    if (query.date === todayWib) {
      slots = slots.filter((slot) => slot > nowWib);
    }

    return {
      date: query.date,
      isOpen: true,
      slots,
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
