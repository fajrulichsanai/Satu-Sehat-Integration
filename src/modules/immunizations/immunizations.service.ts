import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Encounter } from '../encounters/entities/encounter.entity';
import { SatusehatResourceLink } from '../satusehat/sync/entities/satusehat-resource-link.entity';
import { Immunization } from './entities/immunization.entity';
import { CreateImmunizationDto } from './dto/immunization.dto';
import { IMMUNIZATION_ROUTES, IMMUNIZATION_SITES } from './immunization-codes';

/** SATUSEHAT menolak waktu sebelum 3 Juni 2014 */
const MIN_FHIR_DATE = new Date('2014-06-03T00:00:00Z');

@Injectable()
export class ImmunizationsService {
  constructor(
    @InjectRepository(Immunization)
    private readonly repo: Repository<Immunization>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(SatusehatResourceLink)
    private readonly linkRepo: Repository<SatusehatResourceLink>,
  ) {}

  options() {
    return {
      routes: Object.entries(IMMUNIZATION_ROUTES).map(([value, r]) => ({
        value,
        label: r.label,
      })),
      sites: Object.entries(IMMUNIZATION_SITES).map(([value, r]) => ({
        value,
        label: r.label,
      })),
    };
  }

  async list(encounterId: number, clinicId: number) {
    await this.getEncounter(encounterId, clinicId);
    return this.repo.find({
      where: { encounterId, status: Not('entered-in-error') },
      order: { occurredAt: 'ASC', id: 'ASC' },
    });
  }

  /** Riwayat imunisasi pasien (semua kunjungan) */
  async history(patientId: number, clinicId: number) {
    return this.repo.find({
      where: { clinicId, patientId, status: Not('entered-in-error') },
      order: { occurredAt: 'DESC', id: 'DESC' },
    });
  }

  async create(
    encounterId: number,
    clinicId: number,
    dto: CreateImmunizationDto,
    userId: number,
  ) {
    const encounter = await this.getEncounter(encounterId, clinicId);
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    if (occurredAt.getTime() > Date.now() + 5 * 60 * 1000) {
      throw new BadRequestException(
        'Waktu pemberian tidak boleh di masa depan',
      );
    }
    if (occurredAt < MIN_FHIR_DATE) {
      throw new BadRequestException(
        'Waktu pemberian tidak boleh sebelum 3 Juni 2014',
      );
    }
    return this.repo.save(
      this.repo.create({
        clinicId,
        encounterId,
        patientId: encounter.patientId,
        kfaCode: dto.kfaCode,
        vaccineName: dto.vaccineName.trim(),
        doseNumber: dto.doseNumber,
        doseMl:
          dto.doseMl === undefined || dto.doseMl === null
            ? null
            : String(dto.doseMl),
        route: dto.route ?? null,
        site: dto.site ?? null,
        lotNumber: dto.lotNumber?.trim() || null,
        expirationDate: dto.expirationDate ?? null,
        occurredAt,
        note: dto.note?.trim() || null,
        status: 'completed',
        createdBy: userId,
      }),
    );
  }

  /**
   * Belum terkirim → dihapus. Sudah terkirim → entered-in-error (dikirim
   * sekali di sinkronisasi berikutnya, lalu barisnya dibuang).
   */
  async remove(
    encounterId: number,
    clinicId: number,
    id: number,
    userId: number,
  ) {
    await this.getEncounter(encounterId, clinicId);
    const row = await this.repo.findOne({
      where: { id, encounterId, clinicId },
    });
    if (!row || row.status === 'entered-in-error') {
      throw new NotFoundException('Data imunisasi tidak ditemukan');
    }
    const sent = await this.linkRepo.exists({
      where: { clinicId, localType: 'immunization', localId: row.id },
    });
    if (!sent) {
      await this.repo.delete(row.id);
      return { removed: true, pendingSync: false };
    }
    await this.repo.update(row.id, {
      status: 'entered-in-error',
      updatedBy: userId,
    });
    return { removed: true, pendingSync: true };
  }

  private async getEncounter(encounterId: number, clinicId: number) {
    const encounter = await this.encounterRepo.findOne({
      where: { id: encounterId, clinicId },
    });
    if (!encounter) {
      throw new NotFoundException(
        `Kunjungan dengan ID ${encounterId} tidak ditemukan`,
      );
    }
    return encounter;
  }
}
