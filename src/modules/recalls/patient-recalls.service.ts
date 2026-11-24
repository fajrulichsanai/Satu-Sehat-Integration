import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Tarif } from '../tarif/entities/tarif.entity';
import { Patient } from '../patients/entities/patient.entity';
import { recallKindForTarif } from './recall-kind';
import {
  PatientRecall,
  PatientRecallStatus,
} from './entities/patient-recall.entity';
import { RecallIntervalsService } from './recall-intervals.service';
import {
  CreatePatientRecallDto,
  PatientRecallQueryDto,
  UpdatePatientRecallDto,
} from './dto/patient-recall.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';
import { Reservation } from '../reservations/entities/reservation.entity';
import { ReservationStatus } from '../../enums';

interface BillingItemForRecall {
  tarifId: number | null;
  billingItemId: number;
}

export interface PatientRecallWithReservation extends PatientRecall {
  upcomingReservation: { id: number; reservationDate: string } | null;
}

@Injectable()
export class PatientRecallsService {
  private readonly logger = new Logger(PatientRecallsService.name);

  constructor(
    @InjectRepository(PatientRecall)
    private readonly patientRecallRepository: Repository<PatientRecall>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    private readonly recallIntervalsService: RecallIntervalsService,
    @Optional()
    @InjectRepository(Patient)
    private readonly patientRepository?: Repository<Patient>,
  ) {}

  /**
   * Cek reservasi aktif (belum dibatalkan/selesai) per pasien, supaya tombol
   * "Sudah Booking" di daftar recall bisa langsung terhubung ke reservasi
   * yang benar-benar ada, bukan cuma status yang ditandai manual.
   */
  private async findUpcomingReservationsByPatient(
    clinicId: number,
    patientIds: number[],
  ): Promise<Map<number, { id: number; reservationDate: string }>> {
    const map = new Map<number, { id: number; reservationDate: string }>();
    if (patientIds.length === 0) return map;

    const reservations = await this.reservationRepository.find({
      where: {
        clinicId,
        patientId: In(patientIds),
        status: In([ReservationStatus.PENDING, ReservationStatus.CONFIRMED]),
      },
      order: { reservationDate: 'ASC' },
    });

    for (const r of reservations) {
      if (!r.patientId || map.has(r.patientId)) continue;
      map.set(r.patientId, {
        id: r.id,
        reservationDate: r.reservationDate,
      });
    }
    return map;
  }

  async findAll(
    clinicId: number,
    query: PatientRecallQueryDto,
  ): Promise<PaginatedResult<PatientRecallWithReservation>> {
    const qb = this.patientRecallRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.patient', 'patient')
      .leftJoinAndSelect('r.tarif', 'tarif')
      .where('r.clinicId = :clinicId', { clinicId });

    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }

    if (query.kind) {
      qb.andWhere('r.kind = :kind', { kind: query.kind });
    }

    qb.orderBy('r.dueDate', 'ASC').addOrderBy('r.id', 'ASC');

    const page = query.page || 1;
    const limit = query.limit || 20;
    const [recalls, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const patientIds = [...new Set(recalls.map((r) => r.patientId))];
    const reservationByPatient = await this.findUpcomingReservationsByPatient(
      clinicId,
      patientIds,
    );
    const data: PatientRecallWithReservation[] = recalls.map((r) => ({
      ...r,
      upcomingReservation: reservationByPatient.get(r.patientId) ?? null,
    }));

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Kontrol dari jadwal kontrol di SOAP ("Kontrol 3 minggu"): satu baris
   * Follow Up berjenis `kunjungan` (atau jenis lain yang dipilih dokter), sudah
   * berstatus Sudah Booking Ulang karena reservasinya dibuat bersamaan.
   * Pasien + jenis + tanggal yang sama tidak diduplikasi.
   */
  async create(
    clinicId: number,
    dto: CreatePatientRecallDto,
    userId: number,
  ): Promise<PatientRecall> {
    if (this.patientRepository) {
      const patient = await this.patientRepository.findOne({
        where: { id: dto.patientId, clinicId },
      });
      if (!patient) {
        throw new BadRequestException('Pasien tidak ditemukan di klinik ini');
      }
    }
    const kind = dto.kind ?? 'kunjungan';
    const existing = await this.patientRecallRepository.findOne({
      where: {
        clinicId,
        patientId: dto.patientId,
        kind,
        dueDate: dto.dueDate.slice(0, 10),
      },
    });
    if (existing) return existing;
    const booked = dto.booked ?? true;
    return this.patientRecallRepository.save(
      this.patientRecallRepository.create({
        clinicId,
        patientId: dto.patientId,
        tarifId: null,
        billingItemId: null,
        kind,
        dueDate: dto.dueDate.slice(0, 10),
        status: booked
          ? PatientRecallStatus.SUDAH_BOOKING_ULANG
          : PatientRecallStatus.BELUM_DIHUBUNGI,
        notes: dto.notes ?? null,
        createdBy: userId,
      }),
    );
  }

  async update(
    id: number,
    clinicId: number,
    dto: UpdatePatientRecallDto,
    userId: number,
  ): Promise<PatientRecall> {
    const recall = await this.patientRecallRepository.findOne({
      where: { id, clinicId },
    });
    if (!recall) {
      throw new NotFoundException({
        success: false,
        error: { code: 'RECALL_NOT_FOUND', message: 'Recall tidak ditemukan' },
      });
    }

    if (dto.dueDate) recall.dueDate = dto.dueDate;
    if (dto.status) {
      recall.status = dto.status;
      if (dto.status !== PatientRecallStatus.BELUM_DIHUBUNGI) {
        recall.contactedAt = new Date();
        recall.contactedBy = userId;
      } else {
        recall.contactedAt = null;
        recall.contactedBy = null;
      }
    }
    recall.updatedBy = userId;

    return this.patientRecallRepository.save(recall);
  }

  /**
   * Dipanggil dari BillingsService.create() (transaksional, pakai manager
   * yang sama) — untuk tiap billing item yang tarif-nya punya RecallInterval
   * terkonfigurasi, buat satu jadwal recall baru. Kegagalan di sini tidak
   * boleh membatalkan billing, jadi caller membungkus try/catch sendiri.
   */
  async scheduleFromBillingItems(
    manager: EntityManager,
    clinicId: number,
    patientId: number,
    items: BillingItemForRecall[],
    createdBy: number,
  ): Promise<void> {
    const intervalMap =
      await this.recallIntervalsService.findMapForClinic(clinicId);
    if (intervalMap.size === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Jenis kontrol (behel / saluran akar / perawatan) dari nama tindakan.
    const kindByTarif = new Map<number, ReturnType<typeof recallKindForTarif>>();
    try {
      const ids = [...new Set(items.map((i) => i.tarifId).filter(Boolean))] as number[];
      const tarifs = ids.length
        ? await manager.find(Tarif, { where: { id: In(ids) } })
        : [];
      for (const t of tarifs) kindByTarif.set(t.id, recallKindForTarif(t.name, t.kategori));
    } catch {
      // Tanpa jenis pun jadwal recall tetap dibuat (bawaan: perawatan).
    }

    for (const item of items) {
      if (!item.tarifId) continue;
      const intervalDays = intervalMap.get(item.tarifId);
      if (!intervalDays) continue;

      const dueDate = new Date(today);
      dueDate.setDate(dueDate.getDate() + intervalDays);

      const recall = manager.create(PatientRecall, {
        clinicId,
        patientId,
        tarifId: item.tarifId,
        billingItemId: item.billingItemId,
        kind: kindByTarif.get(item.tarifId) ?? 'perawatan',
        dueDate: dueDate.toISOString().slice(0, 10),
        status: PatientRecallStatus.BELUM_DIHUBUNGI,
        createdBy,
      });
      await manager.save(PatientRecall, recall);
      this.logger.log(
        `Recall dijadwalkan untuk pasien ${patientId} pada ${recall.dueDate} (tarif ${item.tarifId})`,
      );
    }
  }
}
