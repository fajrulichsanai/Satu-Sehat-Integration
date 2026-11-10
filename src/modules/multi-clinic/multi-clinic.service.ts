import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import {
  BranchBillingMode,
  LINK_REQUEST_TTL_DAYS,
  OwnerClinicLink,
  OwnerClinicLinkStatus,
} from './entities/owner-clinic-link.entity';
import { User } from '../users/entities/user.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { UserRole } from '../../enums';
import { DashboardService } from '../dashboard/dashboard.service';
import { ClinicSubscriptionsService } from '../subscriptions/clinic-subscriptions.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AuditActionType,
  AuditStatus,
} from '../audit-log/entities/audit-log.entity';
import { MultiClinicMailService } from './multi-clinic-mail.service';
import { accountPoolForOwner } from './account-pool';
import { STORAGE_GB_PER_BRANCH } from './multi-clinic.constants';
import { StorageQuotaService } from '../storage-quota/storage-quota.service';
import type { MultiClinicReportQueryDto } from './dto/owner-clinic-link.dto';

/** Who is acting — enough for the audit log. */
export interface Actor {
  userId: number;
  name?: string;
  role?: string;
  actorRole?: string;
  branchMode?: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const BILLING_MODE_LABEL: Record<BranchBillingMode, string> = {
  [BranchBillingMode.OWNER]: 'Ditanggung owner',
  [BranchBillingMode.SELF]: 'Bayar sendiri',
  [BranchBillingMode.STOPPED]: 'Berhenti',
};

function expiresAt(link: Pick<OwnerClinicLink, 'requestedAt'>): Date | null {
  return link.requestedAt
    ? new Date(
        new Date(link.requestedAt).getTime() + LINK_REQUEST_TTL_DAYS * DAY_MS,
      )
    : null;
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function linkNotFound() {
  return new NotFoundException({
    success: false,
    error: {
      code: 'LINK_NOT_FOUND',
      message: 'Permintaan hubungan tidak ditemukan',
    },
  });
}

@Injectable()
export class MultiClinicService {
  private readonly logger = new Logger(MultiClinicService.name);

  constructor(
    @InjectRepository(OwnerClinicLink)
    private readonly linkRepository: Repository<OwnerClinicLink>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    private readonly dashboardService: DashboardService,
    private readonly dataSource: DataSource,
    private readonly clinicSubscriptions: ClinicSubscriptionsService,
    private readonly auditLog: AuditLogService,
    @Optional() private readonly mail?: MultiClinicMailService,
    @Optional() private readonly storageQuota?: StorageQuotaService,
  ) {}

  private audit(
    actor: Actor,
    clinicId: number | null,
    actionType: AuditActionType,
    entityLabel: string,
    link?: OwnerClinicLink | null,
  ) {
    void this.auditLog.record({
      clinicId,
      actorId: actor.userId,
      actorName: actor.name ?? 'Unknown',
      actorRole: actor.actorRole ?? actor.role ?? 'unknown',
      actionType,
      entityType: 'MultiClinicLink',
      entityId: link?.id ?? null,
      entityLabel: entityLabel.slice(0, 255),
      afterValue: link
        ? {
            ownerId: link.ownerId,
            clinicId: link.clinicId,
            status: link.status,
            billingMode: link.billingMode,
          }
        : null,
      status: AuditStatus.SUCCESS,
    });
  }

  private async clinicOwnerEmails(clinicId: number): Promise<string[]> {
    const owners = await this.userRepository.find({
      // Owner klinik dan Manajer Cabang sama-sama boleh menjawab (PRD alur B).
      where: {
        clinicId,
        role: In([UserRole.OWNER, UserRole.MANAJER_CABANG]),
        isActive: true,
      },
    });
    return owners.map((o) => o.email).filter(Boolean);
  }

  // ─── Super Admin ────────────────────────────────────────────────────────

  /** Super Admin: semua akun multi-klinik owner beserta cabang & permintaannya. */
  async listOwners() {
    const owners = await this.userRepository.find({
      where: { role: UserRole.MULTI_CLINIC_OWNER },
      order: { name: 'ASC' },
    });
    const links = await this.linkRepository.find({
      relations: { clinic: true },
      order: { id: 'ASC' },
    });
    const byOwner = new Map<number, OwnerClinicLink[]>();
    for (const link of links) {
      const list = byOwner.get(link.ownerId) ?? [];
      list.push(link);
      byOwner.set(link.ownerId, list);
    }
    return owners.map((o) => {
      const own = byOwner.get(o.id) ?? [];
      return {
        id: o.id,
        name: o.name,
        email: o.email,
        isActive: o.isActive,
        // Approved branches only — kept for older screens.
        clinics: own
          .filter((l) => l.status === OwnerClinicLinkStatus.APPROVED)
          .map((l) => l.clinic),
        links: own.map((l) => this.describeLink(l)),
      };
    });
  }

  private describeLink(link: OwnerClinicLink) {
    return {
      id: link.id,
      clinicId: link.clinicId,
      clinicName: link.clinic?.name ?? null,
      status: link.status,
      billingMode: link.billingMode,
      requestedAt: link.requestedAt,
      respondedAt: link.respondedAt,
      expiresAt:
        link.status === OwnerClinicLinkStatus.PENDING ? expiresAt(link) : null,
    };
  }

  /**
   * Super Admin: ajukan hubungan klinik → owner multiklinik (PRD alur B).
   * `direct` = cabang baru yang dibuat untuk owner ini (alur C, PS-03):
   * langsung aktif tanpa persetujuan. Satu klinik hanya boleh punya satu
   * owner multiklinik (PS-04); permintaan lama yang ditolak/kedaluwarsa
   * dipakai ulang.
   */
  async requestLink(
    ownerId: number,
    clinicId: number,
    actor: Actor,
    options: { direct?: boolean } = {},
  ) {
    const owner = await this.userRepository.findOne({ where: { id: ownerId } });
    if (!owner || owner.role !== UserRole.MULTI_CLINIC_OWNER) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_OWNER',
          message: 'User bukan akun multi-klinik owner',
        },
      });
    }
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });
    if (!clinic) {
      throw new NotFoundException({
        success: false,
        error: { code: 'CLINIC_NOT_FOUND', message: 'Klinik tidak ditemukan' },
      });
    }

    const existing = await this.linkRepository.findOne({ where: { clinicId } });
    const active =
      existing &&
      (existing.status === OwnerClinicLinkStatus.APPROVED ||
        existing.status === OwnerClinicLinkStatus.PENDING);
    if (active && existing.ownerId !== ownerId) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'CLINIC_ALREADY_LINKED',
          message:
            existing.status === OwnerClinicLinkStatus.APPROVED
              ? 'Klinik ini sudah terhubung ke owner multiklinik lain'
              : 'Klinik ini sedang menunggu persetujuan untuk owner multiklinik lain',
        },
      });
    }
    if (active && existing.status === OwnerClinicLinkStatus.APPROVED) {
      return this.describeLink({ ...existing, clinic });
    }
    if (active && !options.direct) {
      // Already pending for this owner — nothing new to ask.
      return this.describeLink({ ...existing, clinic });
    }

    const now = new Date();
    const link = existing ?? this.linkRepository.create({ clinicId });
    link.ownerId = ownerId;
    link.status = options.direct
      ? OwnerClinicLinkStatus.APPROVED
      : OwnerClinicLinkStatus.PENDING;
    link.requestedAt = now;
    link.requestedBy = actor.userId;
    link.respondedAt = options.direct ? now : null;
    link.respondedBy = options.direct ? actor.userId : null;
    link.billingMode = BranchBillingMode.OWNER;
    link.createdBy = link.createdBy ?? actor.userId;
    link.updatedBy = actor.userId;
    const saved = await this.linkRepository.save(link);

    this.audit(
      actor,
      clinicId,
      AuditActionType.CREATE,
      options.direct
        ? `Hubungkan langsung ${clinic.name} ke ${owner.name}`
        : `Ajukan hubungan ${clinic.name} ke ${owner.name}`,
      saved,
    );

    if (!options.direct) {
      void this.clinicOwnerEmails(clinicId).then((emails) =>
        this.mail?.linkRequested(
          emails,
          clinic.name,
          owner.name,
          expiresAt(saved)!,
        ),
      );
    }
    return this.describeLink({ ...saved, clinic });
  }

  /** @deprecated kept for the old "Hubungkan" call; now a direct link. */
  linkClinic(ownerId: number, clinicId: number, userId: number) {
    return this.requestLink(ownerId, clinicId, { userId }, { direct: true });
  }

  /** Super Admin: putus hubungan / batalkan permintaan (PRD alur D). */
  async unlinkClinic(ownerId: number, clinicId: number, actor?: Actor) {
    const link = await this.linkRepository.findOne({
      where: { ownerId, clinicId },
      relations: { clinic: true },
    });
    if (!link) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'LINK_NOT_FOUND',
          message:
            'Klinik ini tidak terhubung ke akun multi-klinik owner tersebut',
        },
      });
    }
    await this.linkRepository.delete({ id: link.id });
    if (actor) {
      this.audit(
        actor,
        clinicId,
        AuditActionType.DELETE,
        `Putus hubungan ${link.clinic?.name ?? `klinik #${clinicId}`} dari owner #${ownerId}`,
        link,
      );
    }
  }

  // ─── Owner klinik: Persetujuan (PS-01) ──────────────────────────────────

  /** Owner klinik: permintaan untuk kliniknya (menunggu dulu, lalu riwayat). */
  async listRequestsForClinic(clinicId: number) {
    const link = await this.linkRepository.findOne({
      where: { clinicId },
      relations: { owner: true },
    });
    if (!link) return [];
    return [
      {
        id: link.id,
        status: link.status,
        ownerName: link.owner?.name ?? null,
        ownerEmail: link.owner?.email ?? null,
        requestedAt: link.requestedAt,
        respondedAt: link.respondedAt,
        expiresAt:
          link.status === OwnerClinicLinkStatus.PENDING
            ? expiresAt(link)
            : null,
      },
    ];
  }

  /** Penanda di Info Klinik (P1): klinik ini cabang dari akun multiklinik siapa. */
  async currentLinkForClinic(clinicId: number) {
    const link = await this.linkRepository.findOne({
      where: { clinicId, status: OwnerClinicLinkStatus.APPROVED },
      relations: { owner: true },
    });
    if (!link) return null;
    return {
      ownerName: link.owner?.name ?? null,
      linkedSince: link.respondedAt ?? link.requestedAt ?? link.createdAt,
      billingMode: link.billingMode,
    };
  }

  /**
   * Owner klinik menjawab permintaan. Hanya owner klinik itu sendiri — bukan
   * owner multiklinik yang sedang di mode Cabang aktif (ia tak boleh
   * menyetujui permintaannya sendiri).
   */
  async respond(
    linkId: number,
    clinicId: number,
    approve: boolean,
    actor: Actor,
  ) {
    if (actor.branchMode) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'CLINIC_OWNER_ONLY',
          message:
            'Hanya owner klinik ini yang bisa menjawab permintaan hubungan',
        },
      });
    }
    const link = await this.linkRepository.findOne({
      where: { id: linkId, clinicId },
      relations: { clinic: true, owner: true },
    });
    if (!link) throw linkNotFound();
    if (link.status !== OwnerClinicLinkStatus.PENDING) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'LINK_ALREADY_ANSWERED',
          message:
            link.status === OwnerClinicLinkStatus.EXPIRED
              ? 'Permintaan ini sudah kedaluwarsa'
              : 'Permintaan ini sudah dijawab',
        },
      });
    }
    const exp = expiresAt(link);
    if (exp && exp.getTime() <= Date.now()) {
      link.status = OwnerClinicLinkStatus.EXPIRED;
      await this.linkRepository.save(link);
      throw new ConflictException({
        success: false,
        error: {
          code: 'LINK_ALREADY_ANSWERED',
          message: 'Permintaan ini sudah kedaluwarsa',
        },
      });
    }

    link.status = approve
      ? OwnerClinicLinkStatus.APPROVED
      : OwnerClinicLinkStatus.REJECTED;
    link.respondedAt = new Date();
    link.respondedBy = actor.userId;
    link.updatedBy = actor.userId;
    const saved = await this.linkRepository.save(link);

    const clinicName = link.clinic?.name ?? `Klinik #${clinicId}`;
    this.audit(
      actor,
      clinicId,
      AuditActionType.UPDATE,
      `${approve ? 'Setujui' : 'Tolak'} hubungan ${clinicName} ke ${link.owner?.name ?? 'owner multiklinik'}`,
      saved,
    );
    if (link.owner?.email) {
      void this.mail?.linkAnswered([link.owner.email], clinicName, approve);
    }
    return {
      id: saved.id,
      status: saved.status,
      respondedAt: saved.respondedAt,
    };
  }

  /** PS-02: permintaan yang tidak dijawab 90 hari menjadi kedaluwarsa. */
  async expireStaleRequests(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - LINK_REQUEST_TTL_DAYS * DAY_MS);
    const result = await this.linkRepository.update(
      {
        status: OwnerClinicLinkStatus.PENDING,
        requestedAt: LessThan(cutoff),
      },
      { status: OwnerClinicLinkStatus.EXPIRED },
    );
    return result.affected ?? 0;
  }

  // ─── Owner multiklinik ──────────────────────────────────────────────────

  private approvedLinks(ownerId: number) {
    return this.linkRepository.find({
      where: { ownerId, status: OwnerClinicLinkStatus.APPROVED },
      relations: { clinic: true },
      order: { id: 'ASC' },
    });
  }

  /** Multi-klinik owner: cabang yang sudah disetujui. */
  async getMyClinics(ownerId: number) {
    const links = await this.approvedLinks(ownerId);
    return links.map((l) => ({
      ...l.clinic,
      billingMode: l.billingMode,
    }));
  }

  /** Cabang yang ikut tagihan gabungan owner (PRD alur E, MK-05). */
  async getOwnerBilledClinicIds(ownerId: number): Promise<number[]> {
    const links = await this.approvedLinks(ownerId);
    return links
      .filter((l) => l.billingMode === BranchBillingMode.OWNER)
      .map((l) => l.clinicId);
  }

  /** Multi-klinik owner: permintaan yang masih menunggu (untuk dashboard). */
  async getPendingForOwner(ownerId: number) {
    const links = await this.linkRepository.find({
      where: { ownerId, status: OwnerClinicLinkStatus.PENDING },
      relations: { clinic: true },
      order: { id: 'ASC' },
    });
    return links.map((l) => this.describeLink(l));
  }

  /**
   * Hanya hubungan yang sudah disetujui yang memberi akses ke cabang. Used by
   * every by-id endpoint for a multi-klinik owner (no single clinicId).
   */
  async assertOwnsClinic(ownerId: number, clinicId: number): Promise<void> {
    const link = await this.linkRepository.findOne({
      where: { ownerId, clinicId, status: OwnerClinicLinkStatus.APPROVED },
    });
    if (!link) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'CLINIC_NOT_OWNED',
          message: 'Klinik ini bukan milik akun Anda',
        },
      });
    }
  }

  /** MK-06: atur siapa yang membayar cabang ini mulai periode berikutnya. */
  async setBillingMode(
    ownerId: number,
    clinicId: number,
    mode: BranchBillingMode,
    actor: Actor,
  ) {
    const link = await this.linkRepository.findOne({
      where: { ownerId, clinicId, status: OwnerClinicLinkStatus.APPROVED },
      relations: { clinic: true },
    });
    if (!link) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'CLINIC_NOT_OWNED',
          message: 'Klinik ini bukan milik akun Anda',
        },
      });
    }
    if (link.billingMode === mode) return this.describeLink(link);
    const before = link.billingMode;
    link.billingMode = mode;
    link.updatedBy = actor.userId;
    const saved = await this.linkRepository.save(link);
    this.audit(
      actor,
      clinicId,
      AuditActionType.UPDATE,
      `Cara bayar ${link.clinic?.name ?? `klinik #${clinicId}`}: ${BILLING_MODE_LABEL[before]} → ${BILLING_MODE_LABEL[mode]}`,
      saved,
    );
    return this.describeLink(saved);
  }

  /**
   * Dashboard gabungan (MK-03) dengan filter satu cabang, plus status
   * langganan dan jatah akun bersama tiap cabang.
   */
  async getDashboard(ownerId: number, clinicId?: number) {
    const links = await this.approvedLinks(ownerId);
    if (clinicId && !links.some((l) => l.clinicId === clinicId)) {
      await this.assertOwnsClinic(ownerId, clinicId);
    }
    const scoped = clinicId
      ? links.filter((l) => l.clinicId === clinicId)
      : links;

    const perClinic = await Promise.all(
      scoped.map(async (link) => {
        const [summary, subscription] = await Promise.all([
          this.dashboardService.getSummary(link.clinicId),
          this.clinicSubscriptions.getCurrentForClinic(link.clinicId),
        ]);
        return {
          clinic: { id: link.clinicId, name: link.clinic?.name ?? '' },
          billingMode: link.billingMode,
          subscription: subscription
            ? {
                status: subscription.status,
                endDate: subscription.endDate,
                planName: subscription.plan?.name ?? null,
              }
            : null,
          summary,
        };
      }),
    );

    const totals = perClinic.reduce(
      (acc, row) => ({
        totalPatients: acc.totalPatients + toNumber(row.summary.totalPatients),
        activePractitioners:
          acc.activePractitioners + toNumber(row.summary.activePractitioners),
        todayVisits: acc.todayVisits + toNumber(row.summary.todayVisits),
        monthlyRevenue:
          acc.monthlyRevenue + toNumber(row.summary.monthlyRevenue),
        totalTransactions:
          acc.totalTransactions + toNumber(row.summary.totalTransactions),
      }),
      {
        totalPatients: 0,
        activePractitioners: 0,
        todayVisits: 0,
        monthlyRevenue: 0,
        totalTransactions: 0,
      },
    );

    const [pool, pending, storage] = await Promise.all([
      accountPoolForOwner(this.dataSource.manager, ownerId),
      this.getPendingForOwner(ownerId),
      this.storageQuota?.quotaForOwner(ownerId),
    ]);

    return {
      totals,
      clinics: perClinic,
      branches: links.map((l) => ({
        id: l.clinicId,
        name: l.clinic?.name ?? '',
      })),
      pending,
      quota: {
        accountsUsed: pool.used,
        accountsLimit: pool.limit,
        activeBranches: pool.activeBranches,
        storageGbLimit: pool.activeBranches * STORAGE_GB_PER_BRANCH,
        storageUsedBytes: storage?.usedBytes ?? 0,
        storageLimitBytes: storage?.limitBytes ?? 0,
      },
    };
  }

  /**
   * MK-04: laporan kunjungan & keuangan semua cabang (atau satu cabang) di
   * satu halaman. Satu query per metrik untuk semua cabang sekaligus, bukan
   * per cabang, supaya tetap cepat saat cabangnya banyak.
   */
  async getReport(ownerId: number, query: MultiClinicReportQueryDto) {
    const links = await this.approvedLinks(ownerId);
    if (query.clinicId) await this.assertOwnsClinic(ownerId, query.clinicId);
    const scoped = query.clinicId
      ? links.filter((l) => l.clinicId === query.clinicId)
      : links;
    const ids = scoped.map((l) => l.clinicId);
    const range = [query.dateFrom, query.dateTo];

    if (ids.length === 0) {
      return {
        range: { dateFrom: query.dateFrom, dateTo: query.dateTo },
        totals: {
          visits: 0,
          finished: 0,
          cancelled: 0,
          revenue: 0,
          collected: 0,
          outstanding: 0,
          billings: 0,
        },
        clinics: [],
        byDay: [],
      };
    }

    const [visitRows, billingRows, visitDays, billingDays] = await Promise.all([
      this.dataSource.query(
        `SELECT clinic_id AS clinicId, COUNT(*) AS visits,
                SUM(status = 'finished') AS finished,
                SUM(status = 'cancelled') AS cancelled
           FROM encounters
          WHERE clinic_id IN (?) AND DATE(arrived_time) BETWEEN ? AND ?
          GROUP BY clinic_id`,
        [ids, ...range],
      ),
      this.dataSource.query(
        `SELECT clinic_id AS clinicId, COUNT(*) AS billings,
                SUM(grand_total) AS revenue, SUM(paid_amount) AS collected,
                SUM(outstanding_amount) AS outstanding
           FROM billings
          WHERE clinic_id IN (?) AND DATE(created_at) BETWEEN ? AND ?
            AND status != 'cancelled'
          GROUP BY clinic_id`,
        [ids, ...range],
      ),
      this.dataSource.query(
        `SELECT DATE_FORMAT(arrived_time, '%Y-%m-%d') AS date, COUNT(*) AS visits
           FROM encounters
          WHERE clinic_id IN (?) AND DATE(arrived_time) BETWEEN ? AND ?
            AND status != 'cancelled'
          GROUP BY DATE_FORMAT(arrived_time, '%Y-%m-%d')`,
        [ids, ...range],
      ),
      this.dataSource.query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, SUM(grand_total) AS revenue
           FROM billings
          WHERE clinic_id IN (?) AND DATE(created_at) BETWEEN ? AND ?
            AND status != 'cancelled'
          GROUP BY DATE_FORMAT(created_at, '%Y-%m-%d')`,
        [ids, ...range],
      ),
    ]);

    const visitsBy = new Map<number, any>(
      (visitRows as any[]).map((r) => [Number(r.clinicId), r]),
    );
    const billingsBy = new Map<number, any>(
      (billingRows as any[]).map((r) => [Number(r.clinicId), r]),
    );
    const clinics = scoped.map((l) => {
      const v = visitsBy.get(l.clinicId);
      const b = billingsBy.get(l.clinicId);
      return {
        clinic: { id: l.clinicId, name: l.clinic?.name ?? '' },
        visits: toNumber(v?.visits),
        finished: toNumber(v?.finished),
        cancelled: toNumber(v?.cancelled),
        billings: toNumber(b?.billings),
        revenue: toNumber(b?.revenue),
        collected: toNumber(b?.collected),
        outstanding: toNumber(b?.outstanding),
      };
    });
    const totals = clinics.reduce(
      (acc, c) => ({
        visits: acc.visits + c.visits,
        finished: acc.finished + c.finished,
        cancelled: acc.cancelled + c.cancelled,
        revenue: acc.revenue + c.revenue,
        collected: acc.collected + c.collected,
        outstanding: acc.outstanding + c.outstanding,
        billings: acc.billings + c.billings,
      }),
      {
        visits: 0,
        finished: 0,
        cancelled: 0,
        revenue: 0,
        collected: 0,
        outstanding: 0,
        billings: 0,
      },
    );

    const days = new Map<
      string,
      { date: string; visits: number; revenue: number }
    >();
    const day = (date: string) => {
      const key = String(date);
      if (!days.has(key)) days.set(key, { date: key, visits: 0, revenue: 0 });
      return days.get(key)!;
    };
    for (const r of visitDays as any[])
      day(r.date).visits += toNumber(r.visits);
    for (const r of billingDays as any[])
      day(r.date).revenue += toNumber(r.revenue);
    const byDay = [...days.values()].sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    return {
      range: { dateFrom: query.dateFrom, dateTo: query.dateTo },
      totals,
      clinics,
      byDay,
    };
  }

  /** Used by the Super Admin owner list and the billing screens. */
  async clinicsByIds(ids: number[]) {
    if (ids.length === 0) return [];
    return this.clinicRepository.find({ where: { id: In(ids) } });
  }
}
