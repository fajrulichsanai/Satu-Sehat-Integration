import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PrescriptionItem } from './entities/prescription-item.entity';
import { PrescriptionReview } from './entities/prescription-review.entity';
import { EncounterStatus, isClinician } from '../../enums';
import {
  PharmacyQueueQueryDto,
  PharmacyStatus,
} from './dto/pharmacy-query.dto';

/** Tanggal "hari ini" klinik (WIB), sama seperti daftar kunjungan */
function todayInClinicTimezone(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

interface QueueRow {
  encounterId: number;
  patientId: number;
  patientName: string | null;
  noRM: string | null;
  practitionerName: string | null;
  arrivedTime: Date;
  encounterStatus: EncounterStatus;
  itemCount: number;
  dispensedCount: number;
  administeredCount: number;
  handledCount: number;
  drugNames: string[];
  pharmacyStatus: PharmacyStatus;
}

/** Baris mentah dari getRawMany (angka agregat bisa berupa string) */
type RawQueueRow = Record<
  | 'encounterId'
  | 'patientId'
  | 'itemCount'
  | 'dispensedCount'
  | 'administeredCount'
  | 'handledCount',
  string | number
> & {
  patientName: string | null;
  noRM: string | null;
  practitionerName: string | null;
  arrivedTime: Date;
  encounterStatus: EncounterStatus;
  drugNames: string | null;
};

const statusOf = (handled: number, total: number): PharmacyStatus =>
  handled === 0 ? 'pending' : handled >= total ? 'done' : 'partial';

/**
 * Antrean farmasi: satu baris per kunjungan yang punya resep, dengan
 * progres penyerahan/pemberian obat. Penyerahan & pemberian sendiri tetap
 * memakai endpoint resep per kunjungan (tidak ada jalur kirim kedua).
 */
@Injectable()
export class PharmacyService {
  constructor(
    @InjectRepository(PrescriptionItem)
    private readonly itemRepository: Repository<PrescriptionItem>,
    @InjectRepository(PrescriptionReview)
    private readonly reviewRepository: Repository<PrescriptionReview>,
  ) {}

  async queue(
    clinicId: number,
    query: PharmacyQueueQueryDto,
    user: { userId: number; role: string },
  ) {
    const qb = this.itemRepository
      .createQueryBuilder('pi')
      .innerJoin('pi.encounter', 'e')
      .leftJoin('e.patient', 'p')
      .leftJoin('e.practitioner', 'pr')
      .select('e.id', 'encounterId')
      .addSelect('e.patientId', 'patientId')
      .addSelect('p.name', 'patientName')
      .addSelect('p.noRm', 'noRM')
      .addSelect('pr.name', 'practitionerName')
      .addSelect('e.arrivedTime', 'arrivedTime')
      .addSelect('e.status', 'encounterStatus')
      .addSelect('COUNT(pi.id)', 'itemCount')
      .addSelect(
        'SUM(CASE WHEN pi.dispensed_at IS NOT NULL THEN 1 ELSE 0 END)',
        'dispensedCount',
      )
      .addSelect(
        'SUM(CASE WHEN pi.administered_at IS NOT NULL THEN 1 ELSE 0 END)',
        'administeredCount',
      )
      .addSelect(
        'SUM(CASE WHEN pi.dispensed_at IS NOT NULL OR pi.administered_at IS NOT NULL THEN 1 ELSE 0 END)',
        'handledCount',
      )
      .addSelect(
        "GROUP_CONCAT(pi.drug_name ORDER BY pi.sort_order, pi.id SEPARATOR '\\n')",
        'drugNames',
      )
      .where('e.clinicId = :clinicId', { clinicId })
      .andWhere('e.status != :cancelled', {
        cancelled: EncounterStatus.CANCELLED,
      })
      .groupBy('e.id')
      .addGroupBy('p.id')
      .addGroupBy('pr.id')
      .orderBy('e.arrivedTime', 'DESC');

    // Sama dengan daftar kunjungan: dokter/perawat hanya melihat pasiennya
    if (isClinician(user.role)) {
      qb.andWhere(
        'e.practitionerId = (SELECT id FROM practitioners WHERE user_id = :uid LIMIT 1)',
        { uid: user.userId },
      );
    } else if (query.practitionerId) {
      qb.andWhere('e.practitionerId = :practitionerId', {
        practitionerId: query.practitionerId,
      });
    }

    if (query.patientId) {
      // Riwayat obat satu pasien: semua tanggal
      qb.andWhere('e.patientId = :patientId', { patientId: query.patientId });
    } else {
      const today = todayInClinicTimezone();
      const from = query.from ?? query.to ?? today;
      const to = query.to ?? query.from ?? today;
      qb.andWhere('DATE(e.arrivedTime) BETWEEN :from AND :to', {
        from: from <= to ? from : to,
        to: from <= to ? to : from,
      });
    }

    const search = query.search?.trim();
    if (search) {
      qb.andWhere(
        `(p.name LIKE :search OR p.noRm LIKE :search OR e.id IN (
          SELECT s.encounter_id FROM prescription_items s WHERE s.drug_name LIKE :search
        ))`,
        { search: `%${search.replace(/[\\%_]/g, '\\$&')}%` },
      );
    }

    const rows: QueueRow[] = (await qb.getRawMany<RawQueueRow>()).map((r) => {
      const itemCount = Number(r.itemCount) || 0;
      const handledCount = Number(r.handledCount) || 0;
      return {
        encounterId: Number(r.encounterId),
        patientId: Number(r.patientId),
        patientName: r.patientName ?? null,
        noRM: r.noRM ?? null,
        practitionerName: r.practitionerName ?? null,
        arrivedTime: r.arrivedTime,
        encounterStatus: r.encounterStatus,
        itemCount,
        dispensedCount: Number(r.dispensedCount) || 0,
        administeredCount: Number(r.administeredCount) || 0,
        handledCount,
        drugNames: r.drugNames ? r.drugNames.split('\n') : [],
        pharmacyStatus: statusOf(handledCount, itemCount),
      };
    });

    // Statistik dihitung sebelum filter status supaya kartu tetap informatif
    const stats = {
      total: rows.length,
      pending: rows.filter((r) => r.pharmacyStatus === 'pending').length,
      partial: rows.filter((r) => r.pharmacyStatus === 'partial').length,
      done: rows.filter((r) => r.pharmacyStatus === 'done').length,
    };

    const filtered = query.status
      ? rows.filter((r) => r.pharmacyStatus === query.status)
      : rows;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const pageRows = filtered.slice((page - 1) * limit, page * limit);

    const reviewed = pageRows.length
      ? await this.reviewRepository.find({
          where: { encounterId: In(pageRows.map((r) => r.encounterId)) },
          select: { encounterId: true, reviewedAt: true },
        })
      : [];
    const reviewedAt = new Map(
      reviewed.map((r) => [r.encounterId, r.reviewedAt]),
    );

    return {
      data: pageRows.map((r) => ({
        ...r,
        reviewedAt: reviewedAt.get(r.encounterId) ?? null,
      })),
      stats,
      meta: {
        total: filtered.length,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(filtered.length / limit)),
      },
    };
  }
}
