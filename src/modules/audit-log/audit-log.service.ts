import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import {
  AuditLog,
  AuditActionType,
  AuditStatus,
} from './entities/audit-log.entity';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { PaginatedResult, paginate } from '../../common/dto/pagination.dto';

export interface RecordAuditLogInput {
  clinicId: number | null;
  actorId: number | null;
  actorName: string;
  actorRole: string;
  actionType: AuditActionType;
  entityType: string;
  entityId?: string | number | null;
  entityLabel?: string | null;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
  status?: AuditStatus;
  failureReason?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/** Bulk-read detection (SATUSEHAT self-assessment No. 22): more than this
 * many successful reads by one user within the window is flagged. */
const VIEW_ALERT_WINDOW_MS = 10 * 60_000;
const DEFAULT_VIEW_ALERT_THRESHOLD = 150;

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  /** actorId → time of last alert, so one burst raises one alert, not hundreds. */
  private readonly lastViewAlert = new Map<number, number>();

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Never throws — a broken audit write must not block the business
   * operation it's describing. Failures are logged instead.
   */
  async record(input: RecordAuditLogInput): Promise<void> {
    try {
      const entry = this.auditLogRepository.create({
        clinicId: input.clinicId,
        actorId: input.actorId,
        actorName: input.actorName,
        actorRole: input.actorRole,
        actionType: input.actionType,
        entityType: input.entityType,
        entityId:
          input.entityId !== undefined && input.entityId !== null
            ? String(input.entityId)
            : null,
        entityLabel: input.entityLabel ?? null,
        beforeValue: input.beforeValue ?? null,
        afterValue: input.afterValue ?? null,
        status: input.status ?? AuditStatus.SUCCESS,
        failureReason: input.failureReason ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
      await this.auditLogRepository.save(entry);

      if (
        input.actionType === AuditActionType.VIEW &&
        input.actorId !== null &&
        (input.status ?? AuditStatus.SUCCESS) === AuditStatus.SUCCESS
      ) {
        await this.checkBulkReads(input);
      }
    } catch (err) {
      this.logger.error(
        `Gagal mencatat audit log: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  private async checkBulkReads(input: RecordAuditLogInput): Promise<void> {
    const actorId = input.actorId as number;
    const now = Date.now();
    const last = this.lastViewAlert.get(actorId);
    if (last && now - last < VIEW_ALERT_WINDOW_MS) return;

    const threshold =
      parseInt(process.env.AUDIT_VIEW_ALERT_THRESHOLD ?? '', 10) ||
      DEFAULT_VIEW_ALERT_THRESHOLD;
    const since = new Date(now - VIEW_ALERT_WINDOW_MS);
    const count = await this.auditLogRepository.count({
      where: {
        actorId,
        actionType: AuditActionType.VIEW,
        status: AuditStatus.SUCCESS,
        createdAt: MoreThan(since),
      },
    });
    if (count <= threshold) return;

    this.lastViewAlert.set(actorId, now);
    // Structured so the central log pipeline can alert on event=bulk_read.
    this.logger.warn(
      JSON.stringify({
        event: 'bulk_read',
        actorId,
        actorName: input.actorName,
        actorRole: input.actorRole,
        clinicId: input.clinicId,
        reads: count,
        windowMinutes: VIEW_ALERT_WINDOW_MS / 60_000,
        ip: input.ipAddress ?? null,
      }),
    );
    await this.record({
      clinicId: input.clinicId,
      actorId,
      actorName: input.actorName,
      actorRole: input.actorRole,
      actionType: AuditActionType.ALERT,
      entityType: 'SecurityAlert',
      entityLabel: `Akses massal: ${count} data dibuka dalam ${VIEW_ALERT_WINDOW_MS / 60_000} menit`,
      status: AuditStatus.FAILED,
      failureReason: 'BULK_READ_ANOMALY',
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  }

  private buildQuery(clinicId: number | null, query: AuditLogQueryDto) {
    const qb = this.auditLogRepository.createQueryBuilder('a');

    // SUPER_ADMIN carries clinicId = null and sees every clinic; everyone else
    // is hard-scoped to their own clinic — this is the tenant isolation boundary.
    // A SUPER_ADMIN may still narrow to one clinic via query.clinicId; that filter
    // is ignored for tenant-scoped callers since their clinicId already wins.
    if (clinicId !== null) {
      qb.andWhere('a.clinicId = :clinicId', { clinicId });
    } else if (query.clinicId) {
      qb.andWhere('a.clinicId = :queryClinicId', {
        queryClinicId: query.clinicId,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('a.createdAt >= :dateFrom', { dateFrom: query.dateFrom });
    }
    if (query.dateTo) {
      qb.andWhere('a.createdAt <= :dateTo', { dateTo: query.dateTo });
    }
    if (query.actorId) {
      qb.andWhere('a.actorId = :actorId', { actorId: query.actorId });
    }
    if (query.actionType) {
      qb.andWhere('a.actionType = :actionType', {
        actionType: query.actionType,
      });
    }
    if (query.entityType) {
      qb.andWhere('a.entityType = :entityType', {
        entityType: query.entityType,
      });
    }
    if (query.search) {
      qb.andWhere('(a.actorName LIKE :search OR a.entityLabel LIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('a.createdAt', 'DESC');
    return qb;
  }

  async findAll(
    clinicId: number | null,
    query: AuditLogQueryDto,
  ): Promise<PaginatedResult<AuditLog>> {
    const qb = this.buildQuery(clinicId, query);
    return paginate(qb, query);
  }

  async findOne(id: number, clinicId: number | null): Promise<AuditLog> {
    const qb = this.auditLogRepository
      .createQueryBuilder('a')
      .where('a.id = :id', { id });
    if (clinicId !== null) {
      qb.andWhere('a.clinicId = :clinicId', { clinicId });
    }
    const entry = await qb.getOne();
    if (!entry) {
      throw new NotFoundException({
        success: false,
        error: { code: 'AUDIT_LOG_NOT_FOUND', message: 'Log tidak ditemukan' },
      });
    }
    return entry;
  }

  async exportCsv(
    clinicId: number | null,
    query: AuditLogQueryDto,
  ): Promise<string> {
    const qb = this.buildQuery(clinicId, query).take(10000);
    const rows = await qb.getMany();

    const escape = (value: unknown) => {
      const s = value === null || value === undefined ? '' : String(value);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const header = [
      'Timestamp',
      'Actor',
      'Role',
      'Action',
      'Entity Type',
      'Entity',
      'Status',
      'IP Address',
    ];
    const lines = [header.map(escape).join(',')];
    for (const row of rows) {
      lines.push(
        [
          row.createdAt.toISOString(),
          row.actorName,
          row.actorRole,
          row.actionType,
          row.entityType,
          row.entityLabel || row.entityId || '',
          row.status,
          row.ipAddress || '',
        ]
          .map(escape)
          .join(','),
      );
    }
    return lines.join('\n');
  }
}
