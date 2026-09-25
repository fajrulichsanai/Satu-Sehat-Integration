import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Practitioner } from '../practitioners/entities/practitioner.entity';
import { Tarif } from '../tarif/entities/tarif.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { ReservationsService } from '../reservations/reservations.service';
import { PublicService } from '../public/public.service';
import {
  ApiCreateReservationDto,
  ApiLookupReservationDto,
} from './dto/api-key.dto';
import { ReservationStatus } from '../../enums';
import { jakartaDate } from './api-keys.service';

/** Failed lookups allowed per phone number (per clinic) and per API key
 * within LOOKUP_WINDOW_MS — stops guessing a name for a known number, and
 * spraying many numbers through one key. */
const LOOKUP_WINDOW_MS = 15 * 60_000;
const LOOKUP_FAILS_PER_PHONE = 5;
const LOOKUP_FAILS_PER_KEY = 100;

/** 0812-3456 789 / +62 812… / 62812… → 08123456789 */
export function normalizePhone(value: string): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.startsWith('62') ? `0${digits.slice(2)}` : digits;
}

/** Case, punctuation and extra spaces don't matter: "  sri  WAHYUNI." = "Sri Wahyuni". */
export function normalizeName(value: string): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Data behind the public API (/v1). Every method is scoped to the clinic that
 * owns the API key — callers never pass a clinicId — and returns only what a
 * clinic would put on its own website: no patient records.
 */
@Injectable()
export class PublicApiService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(Practitioner)
    private readonly practitionerRepository: Repository<Practitioner>,
    @InjectRepository(Tarif)
    private readonly tarifRepository: Repository<Tarif>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    private readonly reservationsService: ReservationsService,
    private readonly publicService: PublicService,
  ) {}

  private readonly lookupFails = new Map<string, number[]>();

  async clinic(clinicId: number, fileBase: string) {
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        province: true,
        postalCode: true,
        phone: true,
        email: true,
        website: true,
        operationalHours: true,
        logoUrl: true,
      },
    });
    if (!clinic) throw new NotFoundException('Klinik tidak ditemukan');
    return { ...clinic, logoUrl: absoluteUrl(clinic.logoUrl, fileBase) };
  }

  async practitioners(clinicId: number, fileBase: string) {
    const rows = await this.practitionerRepository.find({
      where: { clinicId, isActive: true },
      select: {
        id: true,
        name: true,
        specialization: true,
        photoUrl: true,
        jadwalPraktik: true,
      },
      order: { id: 'ASC' },
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      specialization: p.specialization ?? null,
      photoUrl: absoluteUrl(p.photoUrl, fileBase),
      /** Null means the doctor follows the clinic's operationalHours. */
      jadwalPraktik: p.jadwalPraktik ?? null,
    }));
  }

  services(clinicId: number) {
    return this.tarifRepository.find({
      where: { clinicId, isActive: true },
      select: {
        id: true,
        name: true,
        kategori: true,
        deskripsi: true,
        hargaJual: true,
      },
      order: { kategori: 'ASC', name: 'ASC' },
    });
  }

  slots(clinicId: number, date: string, practitionerId?: number) {
    return this.publicService.getAvailableSlots({
      clinicId,
      date,
      practitionerId,
    } as never);
  }

  async createReservation(clinicId: number, dto: ApiCreateReservationDto) {
    if (dto.practitionerId)
      await this.assertPractitioner(clinicId, dto.practitionerId);
    const r = await this.reservationsService.createPublic({
      ...dto,
      clinicId,
    } as never);
    return {
      token: r.token,
      status: r.status,
      reservationDate: r.reservationDate,
      jamSlot: r.jamSlot ? String(r.jamSlot).slice(0, 5) : null,
      practitionerId: r.practitionerId ?? null,
      patientName: r.patientName,
    };
  }

  async reservationStatus(clinicId: number, token: string) {
    await this.assertReservation(clinicId, token);
    const r = await this.reservationsService.getStatusByToken(token);
    return {
      token: r.token,
      status: r.status,
      reservationDate: r.reservationDate,
      jamSlot: r.jamSlot ? String(r.jamSlot).slice(0, 5) : null,
      patientName: r.patientName,
      practitionerId: r.practitionerId ?? null,
      practitionerName: r.practitioner?.name ?? null,
    };
  }

  async cancelReservation(clinicId: number, token: string) {
    await this.assertReservation(clinicId, token);
    const r = await this.reservationsService.cancelByToken(token);
    return { token: r.token, status: r.status };
  }

  /**
   * Upcoming pending/confirmed reservations whose phone and name both match
   * (at most 5, soonest first). A miss answers the same whether the number is
   * unknown or the name is wrong, and counts toward the failure limits.
   */
  async lookupReservations(
    clinicId: number,
    apiKeyId: number,
    dto: ApiLookupReservationDto,
  ) {
    const phone = normalizePhone(dto.patientPhone);
    const name = normalizeName(dto.patientName);
    const phoneKey = `phone:${clinicId}:${phone}`;
    const keyKey = `key:${apiKeyId}`;
    if (
      this.failCount(phoneKey) >= LOOKUP_FAILS_PER_PHONE ||
      this.failCount(keyKey) >= LOOKUP_FAILS_PER_KEY
    ) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: 'LOOKUP_LIMITED',
            message:
              'Terlalu banyak percobaan. Coba lagi dalam 15 menit, atau hubungi klinik.',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const candidates =
      phone.length >= 8 && name
        ? await this.reservationRepository.find({
            where: {
              clinicId,
              status: In([
                ReservationStatus.PENDING,
                ReservationStatus.CONFIRMED,
              ]),
              reservationDate: MoreThanOrEqual(jakartaDate()) as never,
            },
            relations: { practitioner: true },
            order: { reservationDate: 'ASC', jamSlot: 'ASC' },
            take: 500,
          })
        : [];
    const matches = candidates
      .filter(
        (r) =>
          normalizePhone(r.patientPhone) === phone &&
          normalizeName(r.patientName) === name,
      )
      .slice(0, 5);

    if (matches.length === 0) {
      this.recordFail(phoneKey);
      this.recordFail(keyKey);
      throw new NotFoundException({
        success: false,
        error: {
          code: 'RESERVATION_NOT_FOUND',
          message:
            'Tidak ada reservasi aktif dengan nomor dan nama tersebut. Periksa kembali, atau hubungi klinik.',
        },
      });
    }
    this.lookupFails.delete(phoneKey);
    return matches.map((r) => ({
      token: r.token,
      status: r.status,
      reservationDate: r.reservationDate,
      jamSlot: r.jamSlot ? String(r.jamSlot).slice(0, 5) : null,
      patientName: r.patientName,
      practitionerId: r.practitionerId ?? null,
      practitionerName: r.practitioner?.name ?? null,
    }));
  }

  private failCount(key: string): number {
    const since = Date.now() - LOOKUP_WINDOW_MS;
    const recent = (this.lookupFails.get(key) ?? []).filter((t) => t > since);
    if (recent.length) this.lookupFails.set(key, recent);
    else this.lookupFails.delete(key);
    return recent.length;
  }

  private recordFail(key: string) {
    this.lookupFails.set(key, [
      ...(this.lookupFails.get(key) ?? []),
      Date.now(),
    ]);
  }

  private async assertPractitioner(clinicId: number, id: number) {
    const found = await this.practitionerRepository.exists({
      where: { id, clinicId, isActive: true },
    });
    if (!found)
      throw new NotFoundException('Dokter tidak ditemukan di klinik ini');
  }

  /** Tokens are unique across clinics; a key may only see its own clinic's bookings. */
  private async assertReservation(clinicId: number, token: string) {
    const found = await this.reservationRepository.exists({
      where: { token, clinicId },
    });
    if (!found)
      throw new NotFoundException(
        'Reservasi dengan token tersebut tidak ditemukan',
      );
  }
}

/** Uploads stored on the API's own disk come back as "/files/..." — make them absolute. */
function absoluteUrl(
  url: string | null | undefined,
  base: string,
): string | null {
  if (!url) return null;
  return url.startsWith('/') ? `${base}${url}` : url;
}
