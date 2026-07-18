import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encounter } from './entities/encounter.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { EncounterStatus, ServiceType } from '../../enums';
import { ReservationStatus } from '../../enums/reservation-status.enum';
import { UserRole } from '../../enums/user-role.enum';
import {
  CreateEncounterDto,
  EncounterListQueryDto,
  UpdateEncounterStatusDto,
} from './dto/encounter.dto';

@Injectable()
export class EncountersService {
  private readonly logger = new Logger(EncountersService.name);

  constructor(
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
  ) {}

  async findAll(clinicId: number, query: EncounterListQueryDto, user: any) {
    this.logger.log(
      `[GET-ALL] Mengambil daftar encounter | clinicId=${clinicId}, date=${query.date || 'today'}`,
    );
    const qb = this.encounterRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.patient', 'patient')
      .leftJoinAndSelect('e.practitioner', 'practitioner')
      .where('e.clinicId = :clinicId', { clinicId });

    // Dokter only sees own encounters
    if (user.role === UserRole.DOKTER) {
      qb.andWhere(
        'e.practitionerId = (SELECT id FROM practitioners WHERE user_id = :uid LIMIT 1)',
        {
          uid: user.userId,
        },
      );
    } else if (query.practitionerId) {
      qb.andWhere('e.practitionerId = :practitionerId', {
        practitionerId: query.practitionerId,
      });
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
    this.logger.log(
      `[GET] Mengambil detail encounter | id=${id}, clinicId=${clinicId}`,
    );
    const encounter = await this.encounterRepository.findOne({
      where: { id, clinicId },
      relations: {
        patient: true,
        practitioner: true,
        location: true,
        reservation: true,
      },
    });
    if (!encounter) {
      this.logger.warn(
        `[GET] Encounter tidak ditemukan | id=${id}, clinicId=${clinicId}`,
      );
      throw new NotFoundException(`Encounter dengan ID ${id} tidak ditemukan`);
    }

    if (user?.role === UserRole.DOKTER) {
      const isOwn = await this.isDokterOwn(
        encounter.practitionerId,
        user.userId,
      );
      if (!isOwn) {
        throw new ForbiddenException('Akses ditolak: bukan kunjungan Anda');
      }
    }

    return encounter;
  }

  async create(
    clinicId: number,
    dto: CreateEncounterDto,
    userId: number,
  ): Promise<Encounter> {
    this.logger.log(
      `[CREATE] Membuat encounter baru | clinicId=${clinicId}, patientId=${dto.patientId}, practitionerId=${dto.practitionerId}`,
    );
    if (dto.reservationId) {
      const reservation = await this.reservationRepository.findOne({
        where: { id: dto.reservationId, clinicId },
      });
      if (!reservation) {
        throw new NotFoundException(
          `Reservasi dengan ID ${dto.reservationId} tidak ditemukan`,
        );
      }
      if (reservation.status !== ReservationStatus.CONFIRMED) {
        throw new BadRequestException(
          'Reservasi harus berstatus confirmed sebelum check-in',
        );
      }
    }

    const encounter = this.encounterRepository.create({
      clinicId,
      patientId: dto.patientId,
      practitionerId: dto.practitionerId,
      locationId: dto.locationId,
      reservationId: dto.reservationId,
      serviceType: dto.serviceType || ServiceType.OUTPATIENT,
      chiefComplaint: dto.chiefComplaint,
      status: EncounterStatus.ARRIVED,
      arrivedTime: new Date(),
      createdBy: userId,
    });

    const saved = await this.encounterRepository.save(encounter);
    this.logger.log(
      `[CREATE] Encounter berhasil dibuat | id=${saved.id}, clinicId=${clinicId}`,
    );

    if (dto.reservationId) {
      await this.reservationRepository.update(dto.reservationId, {
        status: ReservationStatus.COMPLETED,
      });
    }

    return saved;
  }

  async updateStatus(
    id: number,
    clinicId: number,
    dto: UpdateEncounterStatusDto,
    user: any,
  ): Promise<Encounter> {
    this.logger.log(
      `[STATUS-UPDATE] Memperbarui status encounter | id=${id}, clinicId=${clinicId}, newStatus=${dto.status}`,
    );
    const encounter = await this.encounterRepository.findOne({
      where: { id, clinicId },
    });
    if (!encounter) {
      this.logger.warn(
        `[STATUS-UPDATE] Encounter tidak ditemukan | id=${id}, clinicId=${clinicId}`,
      );
      throw new NotFoundException(`Encounter dengan ID ${id} tidak ditemukan`);
    }

    if (user.role === UserRole.DOKTER) {
      const isOwn = await this.isDokterOwn(
        encounter.practitionerId,
        user.userId,
      );
      if (!isOwn) {
        throw new ForbiddenException('Akses ditolak: bukan kunjungan Anda');
      }
    }

    this.validateTransition(encounter.status, dto.status);

    if (dto.status === EncounterStatus.CANCELLED && !dto.reason) {
      throw new BadRequestException('Alasan pembatalan wajib diisi');
    }

    const now = new Date();
    encounter.status = dto.status;
    encounter.updatedBy = user.userId;

    if (dto.status === EncounterStatus.IN_PROGRESS) {
      encounter.inProgressTime = now;
    } else if (dto.status === EncounterStatus.FINISHED) {
      encounter.finishedTime = now;
    } else if (dto.status === EncounterStatus.CANCELLED) {
      encounter.cancelledReason = dto.reason as string;
    }

    const result = await this.encounterRepository.save(encounter);
    this.logger.log(
      `[STATUS-UPDATE] Status encounter berhasil diperbarui | id=${id}, status=${dto.status}`,
    );
    return result;
  }

  private validateTransition(from: EncounterStatus, to: EncounterStatus): void {
    const allowed: Record<EncounterStatus, EncounterStatus[]> = {
      [EncounterStatus.ARRIVED]: [
        EncounterStatus.IN_PROGRESS,
        EncounterStatus.CANCELLED,
      ],
      [EncounterStatus.IN_PROGRESS]: [
        EncounterStatus.FINISHED,
        EncounterStatus.CANCELLED,
      ],
      [EncounterStatus.FINISHED]: [],
      [EncounterStatus.CANCELLED]: [],
    };

    if (!allowed[from]?.includes(to)) {
      throw new BadRequestException(
        `Transisi status dari '${from}' ke '${to}' tidak diizinkan`,
      );
    }
  }

  private async isDokterOwn(
    practitionerId: number,
    userId: number,
  ): Promise<boolean> {
    const result = await this.encounterRepository.query(
      'SELECT id FROM practitioners WHERE id = ? AND user_id = ? LIMIT 1',
      [practitionerId, userId],
    );
    return result.length > 0;
  }
}
