import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { Queue } from './entities/queue.entity';
import { QueueStatus } from '../../enums';
import { CreateQueueDto, QueueQueryDto, SlotsQueryDto, UpdateQueueStatusDto } from './dto/queue.dto';
import { startOfDay, endOfDay } from '../../common/utils/date.util';
import { paginate, PaginatedResult } from '../../common/dto/pagination.dto';

const STATUS_TRANSITIONS: Partial<Record<QueueStatus, QueueStatus[]>> = {
  [QueueStatus.WAITING]: [QueueStatus.CALLED, QueueStatus.CANCELLED],
  [QueueStatus.CONFIRMED]: [QueueStatus.CALLED, QueueStatus.CANCELLED],
  [QueueStatus.CALLED]: [QueueStatus.DONE, QueueStatus.CANCELLED, QueueStatus.CALLED],
  [QueueStatus.DONE]: [],
  [QueueStatus.CANCELLED]: [],
};

const SLOT_TIMES = Array.from({ length: 18 }, (_, i) => {
  const hour = Math.floor(i / 2) + 8;
  const min = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${min}`;
});

@Injectable()
export class QueuesService {
  constructor(
    @InjectRepository(Queue)
    private readonly queueRepository: Repository<Queue>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(clinicId: number, query: QueueQueryDto): Promise<PaginatedResult<Queue>> {
    const targetDate = query.date ? new Date(query.date) : new Date();
    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);

    const qb = this.queueRepository
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.practitioner', 'practitioner')
      .where('q.clinicId = :clinicId', { clinicId })
      .andWhere('q.tanggal BETWEEN :start AND :end', { start, end });

    if (query.status) {
      qb.andWhere('q.status = :status', { status: query.status });
    }
    if (query.locationId) {
      qb.andWhere('q.locationId = :locationId', { locationId: query.locationId });
    }
    if (query.practitionerId) {
      qb.andWhere('q.practitionerId = :practitionerId', { practitionerId: query.practitionerId });
    }

    qb.orderBy('q.nomorAntrian', 'ASC');
    return paginate(qb, query);
  }

  async findOne(id: number, clinicId: number): Promise<Queue> {
    const queue = await this.queueRepository.findOne({
      where: { id, clinicId },
      relations: { practitioner: true },
    });
    if (!queue) {
      throw new NotFoundException(`Antrian dengan ID ${id} tidak ditemukan`);
    }
    return queue;
  }

  async create(clinicId: number, dto: CreateQueueDto): Promise<Queue> {
    const tanggal = new Date(dto.appointmentDate);
    const nomorAntrian = await this.generateQueueNumber(clinicId, tanggal);

    const token = this.generateToken();
    const jamSlot = dto.jamSlot || '08:00';

    const queue = this.queueRepository.create({
      clinicId,
      patientId: dto.patientId,
      practitionerId: dto.practitionerId,
      nomorAntrian,
      tanggal,
      jamSlot,
      patientName: dto.patientName,
      phone: dto.phone || '',
      chiefComplaint: dto.chiefComplaint,
      isFirstVisit: dto.isFirstVisit ?? false,
      isOnlineBooking: false,
      token,
      status: QueueStatus.WAITING,
    });

    return this.queueRepository.save(queue);
  }

  async updateStatus(id: number, clinicId: number, dto: UpdateQueueStatusDto): Promise<Queue> {
    const queue = await this.findOne(id, clinicId);

    const allowed = STATUS_TRANSITIONS[queue.status!] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Tidak bisa mengubah status dari ${queue.status} ke ${dto.status}. ` +
        `Status yang diperbolehkan: ${allowed.join(', ') || 'tidak ada'}`,
      );
    }

    queue.status = dto.status;
    if (dto.cancelledReason) {
      queue.cancelledReason = dto.cancelledReason;
    }
    if (dto.status === QueueStatus.CALLED) {
      queue.calledAt = new Date();
    }

    return this.queueRepository.save(queue);
  }

  async getAvailableSlots(clinicId: number, query: SlotsQueryDto) {
    const targetDate = new Date(query.date);
    const start = startOfDay(targetDate);
    const end = endOfDay(targetDate);

    const qb = this.queueRepository
      .createQueryBuilder('q')
      .select('q.jamSlot', 'jamSlot')
      .where('q.clinicId = :clinicId', { clinicId })
      .andWhere('q.tanggal BETWEEN :start AND :end', { start, end })
      .andWhere('q.status NOT IN (:...cancelled)', { cancelled: [QueueStatus.CANCELLED] });

    if (query.practitionerId) {
      qb.andWhere('q.practitionerId = :practitionerId', { practitionerId: query.practitionerId });
    }

    const occupied = await qb.getRawMany();
    const occupiedSlots = new Set(occupied.map((o) => o.jamSlot?.slice(0, 5)));

    return SLOT_TIMES.map((time) => ({
      time,
      available: !occupiedSlots.has(time),
    }));
  }

  async getMonitorData(clinicId: number) {
    const today = new Date();
    return this.queueRepository.find({
      where: {
        clinicId,
        tanggal: Between(startOfDay(today), endOfDay(today)),
        status: QueueStatus.WAITING,
      },
      select: { id: true, nomorAntrian: true, patientName: true, status: true, jamSlot: true },
      order: { nomorAntrian: 'ASC' },
    });
  }

  private async generateQueueNumber(clinicId: number, tanggal: Date): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const start = startOfDay(tanggal);
      const end = endOfDay(tanggal);
      const result = await manager.query(
        `SELECT MAX(nomor_antrian) AS maxNum FROM queues WHERE clinic_id = ? AND tanggal BETWEEN ? AND ?`,
        [clinicId, start, end],
      );
      return (result[0].maxNum || 0) + 1;
    });
  }

  generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}
