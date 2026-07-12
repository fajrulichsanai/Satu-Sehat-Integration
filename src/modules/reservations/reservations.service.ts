import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Reservation } from './entities/reservation.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { ReservationSource, ReservationStatus } from '../../enums';
import {
  CreateReservationDto,
  PublicCreateReservationDto,
  ReservationQueryDto,
  UpdateReservationStatusDto,
} from './dto/reservation.dto';
import { paginate, PaginatedResult } from '../../common/dto/pagination.dto';

const STATUS_TRANSITIONS: Partial<
  Record<ReservationStatus, ReservationStatus[]>
> = {
  [ReservationStatus.PENDING]: [
    ReservationStatus.CONFIRMED,
    ReservationStatus.CANCELLED,
  ],
  [ReservationStatus.CONFIRMED]: [
    ReservationStatus.COMPLETED,
    ReservationStatus.CANCELLED,
  ],
  [ReservationStatus.COMPLETED]: [],
  [ReservationStatus.CANCELLED]: [],
};

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
  ) {}

  async findAll(
    clinicId: number,
    query: ReservationQueryDto,
  ): Promise<PaginatedResult<Reservation>> {
    this.logger.log(
      `[GET-ALL] Mengambil daftar reservasi | clinicId=${clinicId}, date=${query.date || 'all'}`,
    );
    const qb = this.reservationRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.practitioner', 'practitioner')
      .where('r.clinicId = :clinicId', { clinicId });

    if (query.date) {
      qb.andWhere('r.reservationDate = :date', { date: query.date });
    }
    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }
    if (query.practitionerId) {
      qb.andWhere('r.practitionerId = :practitionerId', {
        practitionerId: query.practitionerId,
      });
    }
    if (query.search) {
      qb.andWhere(
        '(r.patientName LIKE :search OR r.patientPhone LIKE :search)',
        {
          search: `%${query.search}%`,
        },
      );
    }

    qb.orderBy('r.reservationDate', 'ASC').addOrderBy('r.jamSlot', 'ASC');
    return paginate(qb, query);
  }

  async findOne(id: number, clinicId: number): Promise<Reservation> {
    this.logger.log(
      `[GET] Mengambil detail reservasi | id=${id}, clinicId=${clinicId}`,
    );
    const reservation = await this.reservationRepository.findOne({
      where: { id, clinicId },
      relations: { practitioner: true },
    });
    if (!reservation) {
      this.logger.warn(
        `[GET] Reservasi tidak ditemukan | id=${id}, clinicId=${clinicId}`,
      );
      throw new NotFoundException(`Reservasi dengan ID ${id} tidak ditemukan`);
    }
    return reservation;
  }

  async create(
    clinicId: number,
    dto: CreateReservationDto,
    source: ReservationSource = ReservationSource.DASHBOARD,
  ): Promise<Reservation> {
    this.logger.log(
      `[CREATE] Membuat reservasi baru | clinicId=${clinicId}, patientName=${dto.patientName}, date=${dto.reservationDate}, source=${source}`,
    );

    const reservation = this.reservationRepository.create({
      clinicId,
      patientId: dto.patientId,
      patientName: dto.patientName,
      patientPhone: dto.patientPhone,
      patientNik: dto.patientNik,
      practitionerId: dto.practitionerId,
      serviceType: dto.serviceType,
      reservationDate: new Date(dto.reservationDate),
      jamSlot: dto.jamSlot,
      notes: dto.notes,
      source,
      status: ReservationStatus.PENDING,
      token: this.generateToken(),
    });

    const saved = await this.reservationRepository.save(reservation);
    this.logger.log(
      `[CREATE] Reservasi berhasil dibuat | id=${saved.id}, token=${saved.token}, clinicId=${clinicId}`,
    );
    return saved;
  }

  async createPublic(dto: PublicCreateReservationDto): Promise<Reservation> {
    const clinic = await this.clinicRepository.findOne({
      where: { id: dto.clinicId, setupComplete: true },
    });
    if (!clinic) {
      throw new NotFoundException('Klinik tidak ditemukan atau belum aktif');
    }

    return this.create(dto.clinicId, dto, ReservationSource.WEBSITE);
  }

  async updateStatus(
    id: number,
    clinicId: number,
    dto: UpdateReservationStatusDto,
  ): Promise<Reservation> {
    this.logger.log(
      `[STATUS-UPDATE] Memperbarui status reservasi | id=${id}, clinicId=${clinicId}, newStatus=${dto.status}`,
    );
    const reservation = await this.findOne(id, clinicId);

    const allowed = STATUS_TRANSITIONS[reservation.status] ?? [];
    if (!allowed.includes(dto.status)) {
      this.logger.warn(
        `[STATUS-UPDATE] Transisi status tidak diizinkan | id=${id}, from=${reservation.status}, to=${dto.status}`,
      );
      throw new BadRequestException(
        `Tidak bisa mengubah status dari ${reservation.status} ke ${dto.status}. ` +
          `Status yang diperbolehkan: ${allowed.join(', ') || 'tidak ada'}`,
      );
    }

    reservation.status = dto.status;
    if (dto.cancelledReason) {
      reservation.cancelledReason = dto.cancelledReason;
    }
    if (dto.status === ReservationStatus.CONFIRMED) {
      reservation.confirmedAt = new Date();
    }

    const updated = await this.reservationRepository.save(reservation);
    this.logger.log(
      `[STATUS-UPDATE] Status reservasi berhasil diperbarui | id=${id}, status=${dto.status}`,
    );
    return updated;
  }

  async remove(id: number, clinicId: number): Promise<void> {
    this.logger.log(
      `[DELETE] Menghapus reservasi | id=${id}, clinicId=${clinicId}`,
    );
    const reservation = await this.findOne(id, clinicId);
    await this.reservationRepository.remove(reservation);
    this.logger.log(
      `[DELETE] Reservasi berhasil dihapus | id=${id}, clinicId=${clinicId}`,
    );
  }

  async getStatusByToken(token: string) {
    const reservation = await this.reservationRepository.findOne({
      where: { token },
      select: {
        id: true,
        token: true,
        patientName: true,
        reservationDate: true,
        jamSlot: true,
        status: true,
        practitionerId: true,
      },
    });
    if (!reservation) {
      throw new NotFoundException(
        'Reservasi dengan token tersebut tidak ditemukan',
      );
    }
    return reservation;
  }

  generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from(
      { length: 8 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join('');
  }
}
