import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Practitioner } from '../practitioners/entities/practitioner.entity';
import { Tarif } from '../tarif/entities/tarif.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { ReservationsService } from '../reservations/reservations.service';
import { PublicService } from '../public/public.service';
import { ApiCreateReservationDto } from './dto/api-key.dto';

/**
 * Data behind the public API (/v1). Every method is scoped to the clinic that
 * owns the API key — callers never pass a clinicId — and returns only what a
 * clinic would put on its own website: no patient records.
 */
@Injectable()
export class PublicApiService {
  constructor(
    @InjectRepository(Clinic) private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(Practitioner) private readonly practitionerRepository: Repository<Practitioner>,
    @InjectRepository(Tarif) private readonly tarifRepository: Repository<Tarif>,
    @InjectRepository(Reservation) private readonly reservationRepository: Repository<Reservation>,
    private readonly reservationsService: ReservationsService,
    private readonly publicService: PublicService,
  ) {}

  async clinic(clinicId: number, fileBase: string) {
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
      select: {
        id: true, name: true, address: true, city: true, province: true, postalCode: true,
        phone: true, email: true, website: true, operationalHours: true, logoUrl: true,
      },
    });
    if (!clinic) throw new NotFoundException('Klinik tidak ditemukan');
    return { ...clinic, logoUrl: absoluteUrl(clinic.logoUrl, fileBase) };
  }

  async practitioners(clinicId: number, fileBase: string) {
    const rows = await this.practitionerRepository.find({
      where: { clinicId, isActive: true },
      select: { id: true, name: true, specialization: true, photoUrl: true, jadwalPraktik: true },
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
      select: { id: true, name: true, kategori: true, deskripsi: true, hargaJual: true },
      order: { kategori: 'ASC', name: 'ASC' },
    });
  }

  slots(clinicId: number, date: string, practitionerId?: number) {
    return this.publicService.getAvailableSlots({ clinicId, date, practitionerId } as never);
  }

  async createReservation(clinicId: number, dto: ApiCreateReservationDto) {
    if (dto.practitionerId) await this.assertPractitioner(clinicId, dto.practitionerId);
    const r = await this.reservationsService.createPublic({ ...dto, clinicId } as never);
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

  private async assertPractitioner(clinicId: number, id: number) {
    const found = await this.practitionerRepository.exists({ where: { id, clinicId, isActive: true } });
    if (!found) throw new NotFoundException('Dokter tidak ditemukan di klinik ini');
  }

  /** Tokens are unique across clinics; a key may only see its own clinic's bookings. */
  private async assertReservation(clinicId: number, token: string) {
    const found = await this.reservationRepository.exists({ where: { token, clinicId } });
    if (!found) throw new NotFoundException('Reservasi dengan token tersebut tidak ditemukan');
  }
}

/** Uploads stored on the API's own disk come back as "/files/..." — make them absolute. */
function absoluteUrl(url: string | null | undefined, base: string): string | null {
  if (!url) return null;
  return url.startsWith('/') ? `${base}${url}` : url;
}
