import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecallInterval } from './entities/recall-interval.entity';
import { UpsertRecallIntervalDto } from './dto/recall-interval.dto';

@Injectable()
export class RecallIntervalsService {
  constructor(
    @InjectRepository(RecallInterval)
    private readonly recallIntervalRepository: Repository<RecallInterval>,
  ) {}

  findAll(clinicId: number) {
    return this.recallIntervalRepository.find({
      where: { clinicId },
      relations: { tarif: true },
      order: { id: 'ASC' },
    });
  }

  async upsert(
    clinicId: number,
    tarifId: number,
    dto: UpsertRecallIntervalDto,
    userId: number,
  ) {
    const existing = await this.recallIntervalRepository.findOne({
      where: { clinicId, tarifId },
    });
    if (existing) {
      existing.intervalDays = dto.intervalDays;
      existing.updatedBy = userId;
      return this.recallIntervalRepository.save(existing);
    }
    const created = this.recallIntervalRepository.create({
      clinicId,
      tarifId,
      intervalDays: dto.intervalDays,
      createdBy: userId,
    });
    return this.recallIntervalRepository.save(created);
  }

  async remove(clinicId: number, tarifId: number) {
    const existing = await this.recallIntervalRepository.findOne({
      where: { clinicId, tarifId },
    });
    if (!existing) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'RECALL_INTERVAL_NOT_FOUND',
          message: 'Interval recall untuk tarif ini belum diatur',
        },
      });
    }
    await this.recallIntervalRepository.delete({ id: existing.id });
  }

  /** Dipakai BillingsService — map tarifId -> intervalDays untuk satu klinik. */
  async findMapForClinic(clinicId: number): Promise<Map<number, number>> {
    const rows = await this.recallIntervalRepository.find({
      where: { clinicId },
    });
    const map = new Map<number, number>();
    for (const row of rows) map.set(row.tarifId, row.intervalDays);
    return map;
  }
}
