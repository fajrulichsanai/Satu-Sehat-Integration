import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  PatientRecall,
  PatientRecallStatus,
} from './entities/patient-recall.entity';
import { RecallIntervalsService } from './recall-intervals.service';
import {
  PatientRecallQueryDto,
  UpdatePatientRecallDto,
} from './dto/patient-recall.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';

interface BillingItemForRecall {
  tarifId: number | null;
  billingItemId: number;
}

@Injectable()
export class PatientRecallsService {
  private readonly logger = new Logger(PatientRecallsService.name);

  constructor(
    @InjectRepository(PatientRecall)
    private readonly patientRecallRepository: Repository<PatientRecall>,
    private readonly recallIntervalsService: RecallIntervalsService,
  ) {}

  async findAll(
    clinicId: number,
    query: PatientRecallQueryDto,
  ): Promise<PaginatedResult<PatientRecall>> {
    const qb = this.patientRecallRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.patient', 'patient')
      .leftJoinAndSelect('r.tarif', 'tarif')
      .where('r.clinicId = :clinicId', { clinicId });

    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }

    qb.orderBy('r.dueDate', 'ASC').addOrderBy('r.id', 'ASC');

    const page = query.page || 1;
    const limit = query.limit || 20;
    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
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
