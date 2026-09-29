import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Resend } from 'resend';
import {
  DataRequest,
  DataRequestStatus,
  DataRequestType,
} from './entities/data-request.entity';
import {
  CreateDataRequestDto,
  UpdateDataRequestDto,
} from './dto/data-request.dto';
import { User } from '../users/entities/user.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { UserRole } from '../../enums';

const OPEN_STATUSES = [
  DataRequestStatus.PENDING,
  DataRequestStatus.IN_PROGRESS,
];
const TYPE_LABEL: Record<DataRequestType, string> = {
  [DataRequestType.EXPORT]: 'Ekspor data klinik',
  [DataRequestType.CLOSE_ACCOUNT]: 'Tutup akun & hapus data',
};
const STATUS_LABEL: Record<DataRequestStatus, string> = {
  [DataRequestStatus.PENDING]: 'Menunggu',
  [DataRequestStatus.IN_PROGRESS]: 'Diproses',
  [DataRequestStatus.COMPLETED]: 'Selesai',
  [DataRequestStatus.REJECTED]: 'Ditolak',
};

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

@Injectable()
export class DataRequestsService {
  private readonly logger = new Logger(DataRequestsService.name);
  private readonly resend: Resend;

  constructor(
    @InjectRepository(DataRequest)
    private readonly repo: Repository<DataRequest>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Clinic)
    private readonly clinicRepo: Repository<Clinic>,
    private readonly configService: ConfigService,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async create(clinicId: number, userId: number, dto: CreateDataRequestDto) {
    const open = await this.repo.findOne({
      where: { clinicId, type: dto.type, status: In(OPEN_STATUSES) },
    });
    if (open) {
      throw new ConflictException(
        `Permintaan "${TYPE_LABEL[dto.type]}" sebelumnya masih diproses. Tunggu sampai selesai sebelum mengajukan lagi.`,
      );
    }
    const saved = await this.repo.save(
      this.repo.create({
        clinicId,
        requestedById: userId,
        type: dto.type,
        reason: dto.reason?.trim() || null,
        status: DataRequestStatus.PENDING,
      }),
    );
    void this.notifySuperAdmins(saved);
    return saved;
  }

  listForClinic(clinicId: number) {
    return this.repo.find({
      where: { clinicId },
      order: { createdAt: 'DESC' },
    });
  }

  async listAll(status?: DataRequestStatus) {
    const rows = await this.repo.find({
      where: status ? { status } : {},
      relations: { clinic: true, requestedBy: true },
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      clinicId: r.clinicId,
      clinicName: r.clinic?.name ?? null,
      requestedBy: r.requestedBy
        ? {
            id: r.requestedBy.id,
            name: r.requestedBy.name,
            email: r.requestedBy.email,
          }
        : null,
      type: r.type,
      reason: r.reason,
      status: r.status,
      adminNote: r.adminNote,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  }

  async update(id: number, adminId: number, dto: UpdateDataRequestDto) {
    const req = await this.repo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Permintaan tidak ditemukan');
    if (!OPEN_STATUSES.includes(req.status)) {
      throw new BadRequestException(
        'Permintaan ini sudah selesai atau ditolak',
      );
    }
    const note = dto.adminNote?.trim() || null;
    if (dto.status === DataRequestStatus.REJECTED && !note) {
      throw new BadRequestException('Tuliskan alasan penolakan untuk klinik');
    }
    req.status = dto.status;
    req.adminNote = note ?? req.adminNote;
    req.handledById = adminId;
    req.completedAt =
      dto.status === DataRequestStatus.IN_PROGRESS ? null : new Date();
    const saved = await this.repo.save(req);
    if (dto.status !== DataRequestStatus.IN_PROGRESS)
      void this.notifyRequester(saved);
    return saved;
  }

  private async notifySuperAdmins(req: DataRequest) {
    try {
      const [admins, clinic] = await Promise.all([
        this.userRepo.find({
          where: { role: UserRole.SUPER_ADMIN, isActive: true },
        }),
        this.clinicRepo.findOne({ where: { id: req.clinicId } }),
      ]);
      const to = admins.map((a) => a.email).filter(Boolean);
      if (!to.length) return;
      const appUrl = this.configService.get<string>(
        'APP_URL',
        'http://localhost:3000',
      );
      await this.resend.emails.send({
        from: 'noreply@send.finarch.my.id',
        to,
        subject: `Permintaan data baru: ${TYPE_LABEL[req.type]} — ${clinic?.name ?? `Klinik #${req.clinicId}`}`,
        html: `
          <h2>${TYPE_LABEL[req.type]}</h2>
          <p>Klinik <strong>${escapeHtml(clinic?.name ?? `#${req.clinicId}`)}</strong> mengajukan permintaan data.</p>
          ${req.reason ? `<p>Alasan: ${escapeHtml(req.reason)}</p>` : ''}
          <p>Sesuai Kebijakan Privasi, tanggapi paling lambat 3 x 24 jam.</p>
          <a href="${appUrl}/super-admin/data-requests">Buka daftar permintaan</a>
        `,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to notify super admins of data request ${req.id}: ${String(err)}`,
      );
    }
  }

  private async notifyRequester(req: DataRequest) {
    try {
      const user = await this.userRepo.findOne({
        where: { id: req.requestedById },
      });
      if (!user?.email) return;
      await this.resend.emails.send({
        from: 'noreply@send.finarch.my.id',
        to: [user.email],
        subject: `Permintaan ${TYPE_LABEL[req.type].toLowerCase()}: ${STATUS_LABEL[req.status]}`,
        html: `
          <p>Halo ${escapeHtml(user.name ?? '')},</p>
          <p>Permintaan <strong>${TYPE_LABEL[req.type]}</strong> yang Anda ajukan sudah <strong>${STATUS_LABEL[req.status].toLowerCase()}</strong>.</p>
          ${req.adminNote ? `<p>Catatan dari tim ApexRecord: ${escapeHtml(req.adminNote)}</p>` : ''}
          <p>Salam,<br>Tim ApexRecord</p>
        `,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to notify requester of data request ${req.id}: ${String(err)}`,
      );
    }
  }
}
