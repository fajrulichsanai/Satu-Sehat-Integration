import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditActionType, AuditStatus } from './entities/audit-log.entity';
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

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

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
        entityId: input.entityId !== undefined && input.entityId !== null ? String(input.entityId) : null,
        entityLabel: input.entityLabel ?? null,
        beforeValue: input.beforeValue ?? null,
        afterValue: input.afterValue ?? null,
        status: input.status ?? AuditStatus.SUCCESS,
        failureReason: input.failureReason ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
      await this.auditLogRepository.save(entry);
    } catch (err) {
      this.logger.error(`Gagal mencatat audit log: ${(err as Error).message}`, (err as Error).stack);
    }
  }

  private buildQuery(clinicId: number | null, query: AuditLogQueryDto) {
    const qb = this.auditLogRepository.createQueryBuilder('a');

    // SUPER_ADMIN carries clinicId = null and sees every clinic; everyone else
    // is hard-scoped to their own clinic — this is the tenant isolation boundary.
    if (clinicId !== null) {
      qb.andWhere('a.clinicId = :clinicId', { clinicId });
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
      qb.andWhere('a.actionType = :actionType', { actionType: query.actionType });
    }
    if (query.entityType) {
      qb.andWhere('a.entityType = :entityType', { entityType: query.entityType });
    }
    if (query.search) {
      qb.andWhere('(a.actorName LIKE :search OR a.entityLabel LIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('a.createdAt', 'DESC');
    return qb;
  }

  async findAll(clinicId: number | null, query: AuditLogQueryDto): Promise<PaginatedResult<AuditLog>> {
    const qb = this.buildQuery(clinicId, query);
    return paginate(qb, query);
  }

  async findOne(id: number, clinicId: number | null): Promise<AuditLog> {
    const qb = this.auditLogRepository.createQueryBuilder('a').where('a.id = :id', { id });
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

  async exportCsv(clinicId: number | null, query: AuditLogQueryDto): Promise<string> {
    const qb = this.buildQuery(clinicId, query).take(10000);
    const rows = await qb.getMany();

    const escape = (value: unknown) => {
      const s = value === null || value === undefined ? '' : String(value);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const header = ['Timestamp', 'Actor', 'Role', 'Action', 'Entity Type', 'Entity', 'Status', 'IP Address'];
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
