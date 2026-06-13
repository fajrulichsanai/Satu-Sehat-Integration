import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encounter } from './entities/encounter.entity';
import { Queue } from '../queues/entities/queue.entity';
import { Anamnesis } from '../anamnesis/entities/anamnesis.entity';
import { VitalSign } from '../vital-sign/entities/vital-sign.entity';
import { Diagnosis } from '../diagnoses/entities/diagnosis.entity';
import { EncounterStatus, ServiceType } from '../../enums';
import { QueueStatus } from '../../enums/queue-status.enum';
import { UserRole } from '../../enums/user-role.enum';
import {
  CreateEncounterDto,
  EncounterListQueryDto,
  UpdateEncounterStatusDto,
} from './dto/encounter.dto';

@Injectable()
export class EncountersService {
  constructor(
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
    @InjectRepository(Queue)
    private readonly queueRepository: Repository<Queue>,
    @InjectRepository(Anamnesis)
    private readonly anamnesisRepository: Repository<Anamnesis>,
    @InjectRepository(VitalSign)
    private readonly vitalSignRepository: Repository<VitalSign>,
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepository: Repository<Diagnosis>,
  ) {}

  async findAll(clinicId: number, query: EncounterListQueryDto, user: any) {
    const qb = this.encounterRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.patient', 'patient')
      .leftJoinAndSelect('e.practitioner', 'practitioner')
      .where('e.clinicId = :clinicId', { clinicId });

    // Dokter only sees own encounters
    if (user.role === UserRole.DOKTER) {
      qb.andWhere('e.practitionerId = (SELECT id FROM practitioners WHERE user_id = :uid LIMIT 1)', {
        uid: user.userId,
      });
    } else if (query.practitionerId) {
      qb.andWhere('e.practitionerId = :practitionerId', { practitionerId: query.practitionerId });
    }

    const date = query.date || new Date().toISOString().split('T')[0];
    qb.andWhere('DATE(e.arrivedTime) = :date', { date });

    if (query.status) {
      qb.andWhere('e.status = :status', { status: query.status });
    }

    qb.orderBy('e.arrivedTime', 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: items.map((e) => ({
        encounterId: e.id,
        patientId: e.patientId,
        patientName: e.patient?.name,
        noRM: e.patient?.noRm,
        practitionerName: e.practitioner?.name,
        status: e.status,
        serviceType: e.serviceType,
        chiefComplaint: e.chiefComplaint,
        arrivedTime: e.arrivedTime,
        inProgressTime: e.inProgressTime,
        finishedTime: e.finishedTime,
        satusehatSyncStatus: e.syncStatus,
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number, clinicId: number, user?: any): Promise<Encounter> {
    const encounter = await this.encounterRepository.findOne({
      where: { id, clinicId },
      relations: { patient: true, practitioner: true, location: true, queue: true },
    });
    if (!encounter) {
      throw new NotFoundException(`Encounter dengan ID ${id} tidak ditemukan`);
    }

    if (user?.role === UserRole.DOKTER) {
      const isOwn = await this.isDokterOwn(encounter.practitionerId, user.userId);
      if (!isOwn) {
        throw new ForbiddenException('Akses ditolak: bukan kunjungan Anda');
      }
    }

    return encounter;
  }

  async create(clinicId: number, dto: CreateEncounterDto, userId: number): Promise<Encounter> {
    if (dto.queueId) {
      const queue = await this.queueRepository.findOne({
        where: { id: dto.queueId, clinicId },
      });
      if (!queue) {
        throw new NotFoundException(`Antrian dengan ID ${dto.queueId} tidak ditemukan`);
      }
      if (queue.status !== QueueStatus.WAITING) {
        throw new BadRequestException('Antrian tidak dalam status waiting');
      }
    }

    const encounter = this.encounterRepository.create({
      clinicId,
      patientId: dto.patientId,
      practitionerId: dto.practitionerId,
      locationId: dto.locationId,
      queueId: dto.queueId,
      serviceType: dto.serviceType || ServiceType.OUTPATIENT,
      chiefComplaint: dto.chiefComplaint,
      status: EncounterStatus.ARRIVED,
      arrivedTime: new Date(),
      createdBy: userId,
    });

    const saved = await this.encounterRepository.save(encounter);

    if (dto.queueId) {
      await this.queueRepository.update(dto.queueId, { status: QueueStatus.CALLED });
    }

    return saved;
  }

  async updateStatus(
    id: number,
    clinicId: number,
    dto: UpdateEncounterStatusDto,
    user: any,
  ): Promise<Encounter> {
    const encounter = await this.encounterRepository.findOne({ where: { id, clinicId } });
    if (!encounter) {
      throw new NotFoundException(`Encounter dengan ID ${id} tidak ditemukan`);
    }

    if (user.role === UserRole.DOKTER) {
      const isOwn = await this.isDokterOwn(encounter.practitionerId, user.userId);
      if (!isOwn) {
        throw new ForbiddenException('Akses ditolak: bukan kunjungan Anda');
      }
    }

    this.validateTransition(encounter.status, dto.status);

    if (dto.status === EncounterStatus.CANCELLED && !dto.reason) {
      throw new BadRequestException('Alasan pembatalan wajib diisi');
    }

    if (dto.status === EncounterStatus.FINISHED) {
      await this.validateFinished(id);
    }

    const now = new Date();
    encounter.status = dto.status;
    encounter.updatedBy = user.userId;

    if (dto.status === EncounterStatus.IN_PROGRESS) {
      encounter.inProgressTime = now;
    } else if (dto.status === EncounterStatus.FINISHED) {
      encounter.finishedTime = now;
      if (encounter.queueId) {
        await this.queueRepository.update(encounter.queueId, { status: QueueStatus.DONE });
      }
    } else if (dto.status === EncounterStatus.CANCELLED) {
      encounter.cancelledReason = dto.reason as string;
      if (encounter.queueId) {
        await this.queueRepository.update(encounter.queueId, { status: QueueStatus.CANCELLED });
      }
    }

    return this.encounterRepository.save(encounter);
  }

  private validateTransition(from: EncounterStatus, to: EncounterStatus): void {
    const allowed: Record<EncounterStatus, EncounterStatus[]> = {
      [EncounterStatus.ARRIVED]: [EncounterStatus.IN_PROGRESS, EncounterStatus.CANCELLED],
      [EncounterStatus.IN_PROGRESS]: [EncounterStatus.FINISHED, EncounterStatus.CANCELLED],
      [EncounterStatus.FINISHED]: [],
      [EncounterStatus.CANCELLED]: [],
    };

    if (!allowed[from]?.includes(to)) {
      throw new BadRequestException(
        `Transisi status dari '${from}' ke '${to}' tidak diizinkan`,
      );
    }
  }

  private async validateFinished(encounterId: number): Promise<void> {
    const missing: string[] = [];

    const anamnesis = await this.anamnesisRepository.findOne({ where: { encounterId } });
    if (!anamnesis) missing.push('anamnesis');

    const vitalCount = await this.vitalSignRepository.count({ where: { encounterId } });
    if (vitalCount === 0) missing.push('vitalSigns');

    const diagnosisCount = await this.diagnosisRepository.count({ where: { encounterId } });
    if (diagnosisCount === 0) missing.push('diagnosis');

    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        code: 'INCOMPLETE_DOCUMENTATION',
        missing,
        message: 'Data klinis belum lengkap untuk menyelesaikan kunjungan',
      });
    }
  }

  private async isDokterOwn(practitionerId: number, userId: number): Promise<boolean> {
    const result = await this.encounterRepository.query(
      'SELECT id FROM practitioners WHERE id = ? AND user_id = ? LIMIT 1',
      [practitionerId, userId],
    );
    return result.length > 0;
  }
}
