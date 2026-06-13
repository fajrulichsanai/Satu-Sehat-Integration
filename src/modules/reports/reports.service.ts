import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encounter } from '../encounters/entities/encounter.entity';
import { Billing } from '../billing/entities/billing.entity';
import { Payment } from '../payments/entities/payment.entity';
import {
  SatusehatSyncLog,
  SyncLogStatus,
} from '../satusehat/sync/entities/satusehat-sync-log.entity';
import { UserRole } from '../../enums/user-role.enum';
import {
  FinancialReportQueryDto,
  RetrySyncDto,
  SatusehatSyncReportQueryDto,
  VisitReportQueryDto,
} from './dto/report.dto';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(Billing)
    private readonly billingRepo: Repository<Billing>,
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(SatusehatSyncLog)
    private readonly syncLogRepo: Repository<SatusehatSyncLog>,
  ) {}

  async getVisitReport(
    clinicId: number,
    query: VisitReportQueryDto,
    user: any,
  ) {
    const qb = this.encounterRepo
      .createQueryBuilder('e')
      .leftJoin('e.patient', 'patient')
      .leftJoin('e.practitioner', 'practitioner')
      .select([
        'e.id',
        'e.status',
        'e.arrivedTime',
        'e.inProgressTime',
        'e.finishedTime',
        'patient.name',
        'practitioner.name',
      ])
      .where('e.clinicId = :clinicId', { clinicId })
      .andWhere('DATE(e.arrivedTime) BETWEEN :dateFrom AND :dateTo', {
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });

    if (user.role === UserRole.DOKTER) {
      qb.andWhere(
        'e.practitionerId = (SELECT id FROM practitioners WHERE user_id = :uid LIMIT 1)',
        { uid: user.userId },
      );
    } else if (query.practitionerId) {
      qb.andWhere('e.practitionerId = :pid', { pid: query.practitionerId });
    }

    if (query.status) {
      qb.andWhere('e.status = :status', { status: query.status });
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const [encounters, total] = await qb
      .orderBy('e.arrivedTime', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // Aggregations via raw queries
    const [summaryRows] = await this.encounterRepo.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'finished') AS finished,
         SUM(status = 'cancelled') AS cancelled,
         SUM(status = 'in_progress') AS inProgress,
         AVG(CASE WHEN finished_time IS NOT NULL AND in_progress_time IS NOT NULL
             THEN TIMESTAMPDIFF(MINUTE, in_progress_time, finished_time) END) AS avgDuration
       FROM encounters
       WHERE clinic_id = ? AND DATE(arrived_time) BETWEEN ? AND ?`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    const byDay = await this.encounterRepo.query(
      `SELECT DATE(arrived_time) AS date, COUNT(*) AS count
       FROM encounters
       WHERE clinic_id = ? AND DATE(arrived_time) BETWEEN ? AND ?
       GROUP BY DATE(arrived_time)
       ORDER BY date ASC`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    const byDoctor = await this.encounterRepo.query(
      `SELECT p.name AS practitionerName, COUNT(*) AS count
       FROM encounters e JOIN practitioners p ON e.practitioner_id = p.id
       WHERE e.clinic_id = ? AND DATE(e.arrived_time) BETWEEN ? AND ?
       GROUP BY p.id, p.name
       ORDER BY count DESC`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    return {
      data: {
        summary: {
          total: parseInt(summaryRows.total),
          finished: parseInt(summaryRows.finished),
          cancelled: parseInt(summaryRows.cancelled),
          inProgress: parseInt(summaryRows.inProgress),
          avgDurationMinutes: summaryRows.avgDuration
            ? Math.round(parseFloat(summaryRows.avgDuration))
            : null,
        },
        byDay: byDay.map((r: any) => ({
          date: r.date,
          count: parseInt(r.count),
        })),
        byDoctor: byDoctor.map((r: any) => ({
          practitionerName: r.practitionerName,
          count: parseInt(r.count),
        })),
        encounters: encounters.map((e) => ({
          encounterId: e.id,
          date: e.arrivedTime?.toISOString().split('T')[0],
          patientName: (e as any).patient?.name,
          practitionerName: (e as any).practitioner?.name,
          status: e.status,
          durationMinutes:
            e.finishedTime && e.inProgressTime
              ? Math.round(
                  (e.finishedTime.getTime() - e.inProgressTime.getTime()) /
                    60000,
                )
              : null,
        })),
      },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getFinancialReport(clinicId: number, query: FinancialReportQueryDto) {
    const [summaryRow] = await this.billingRepo.query(
      `SELECT
         SUM(grand_total) AS totalBilling,
         SUM(paid_amount) AS totalPaid,
         SUM(outstanding_amount) AS totalOutstanding,
         SUM(CASE WHEN status = 'refunded' THEN paid_amount ELSE 0 END) AS totalRefunded,
         COUNT(*) AS totalBillings
       FROM billings
       WHERE clinic_id = ? AND DATE(created_at) BETWEEN ? AND ?
         AND status != 'cancelled'`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    const totalPaid = parseFloat(summaryRow.totalPaid || 0);
    const totalBilling = parseFloat(summaryRow.totalBilling || 0);

    const byDay = await this.billingRepo.query(
      `SELECT DATE(b.created_at) AS date,
         SUM(b.grand_total) AS revenue,
         SUM(p.amount) AS collected
       FROM billings b
       LEFT JOIN payments p ON b.id = p.billing_id
       WHERE b.clinic_id = ? AND DATE(b.created_at) BETWEEN ? AND ?
       GROUP BY DATE(b.created_at)
       ORDER BY date ASC`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    const byPaymentMethod = await this.paymentRepo.query(
      `SELECT p.method, SUM(p.amount) AS amount
       FROM payments p JOIN billings b ON p.billing_id = b.id
       WHERE b.clinic_id = ? AND DATE(p.paid_at) BETWEEN ? AND ?
       GROUP BY p.method`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    const byDoctor = await this.billingRepo.query(
      `SELECT pr.name AS practitionerName, SUM(b.grand_total) AS revenue
       FROM billings b
       JOIN encounters e ON b.encounter_id = e.id
       JOIN practitioners pr ON e.practitioner_id = pr.id
       WHERE b.clinic_id = ? AND DATE(b.created_at) BETWEEN ? AND ?
       GROUP BY pr.id, pr.name
       ORDER BY revenue DESC`,
      [clinicId, query.dateFrom, query.dateTo],
    );

    return {
      data: {
        summary: {
          totalBilling: totalBilling,
          totalPaid: totalPaid,
          totalOutstanding: parseFloat(summaryRow.totalOutstanding || 0),
          collectionRate:
            totalBilling > 0
              ? parseFloat(((totalPaid / totalBilling) * 100).toFixed(1))
              : 0,
          totalRefunded: parseFloat(summaryRow.totalRefunded || 0),
        },
        byDay: byDay.map((r: any) => ({
          date: r.date,
          revenue: parseFloat(r.revenue || 0),
          collected: parseFloat(r.collected || 0),
        })),
        byPaymentMethod: byPaymentMethod.map((r: any) => ({
          method: r.method,
          amount: parseFloat(r.amount || 0),
        })),
        byDoctor: byDoctor.map((r: any) => ({
          practitionerName: r.practitionerName,
          revenue: parseFloat(r.revenue || 0),
        })),
      },
    };
  }

  async getSatusehatSyncReport(
    clinicId: number,
    query: SatusehatSyncReportQueryDto,
  ) {
    const qb = this.syncLogRepo
      .createQueryBuilder('s')
      .where('s.clinicId = :clinicId', { clinicId });

    if (query.dateFrom)
      qb.andWhere('DATE(s.createdAt) >= :dateFrom', {
        dateFrom: query.dateFrom,
      });
    if (query.dateTo)
      qb.andWhere('DATE(s.createdAt) <= :dateTo', { dateTo: query.dateTo });
    if (query.resourceType && query.resourceType !== 'all') {
      qb.andWhere('s.resourceType = :resourceType', {
        resourceType: query.resourceType,
      });
    }
    if (query.syncStatus && query.syncStatus !== 'all') {
      qb.andWhere('s.status = :status', { status: query.syncStatus });
    }

    // Summary
    const [summaryRow] = await this.syncLogRepo.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'success') AS synced,
         SUM(status = 'failed') AS failed,
         SUM(status = 'pending') AS pending
       FROM satusehat_sync_logs
       WHERE clinic_id = ?
       ${query.dateFrom ? 'AND DATE(created_at) >= ?' : ''}
       ${query.dateTo ? 'AND DATE(created_at) <= ?' : ''}`,
      [
        clinicId,
        ...(query.dateFrom ? [query.dateFrom] : []),
        ...(query.dateTo ? [query.dateTo] : []),
      ],
    );

    const total = parseInt(summaryRow.total);
    const synced = parseInt(summaryRow.synced);

    const byResource = await this.syncLogRepo.query(
      `SELECT resource_type AS resourceType,
         SUM(status = 'success') AS synced,
         SUM(status = 'failed') AS failed,
         SUM(status = 'pending') AS pending
       FROM satusehat_sync_logs
       WHERE clinic_id = ?
       GROUP BY resource_type`,
      [clinicId],
    );

    const failedItems = await this.syncLogRepo.find({
      where: { clinicId, status: SyncLogStatus.FAILED },
      order: { createdAt: 'DESC' },
      take: 50,
      select: {
        resourceType: true,
        localId: true,
        errorMessage: true,
        retryCount: true,
        createdAt: true,
      },
    });

    return {
      data: {
        summary: {
          total,
          synced,
          failed: parseInt(summaryRow.failed),
          pending: parseInt(summaryRow.pending),
          syncRate:
            total > 0 ? parseFloat(((synced / total) * 100).toFixed(1)) : 0,
        },
        byResource: byResource.map((r: any) => ({
          resourceType: r.resourceType,
          synced: parseInt(r.synced),
          failed: parseInt(r.failed),
          pending: parseInt(r.pending),
        })),
        failedItems: failedItems.map((f) => ({
          resourceType: f.resourceType,
          localId: f.localId,
          errorMessage: f.errorMessage,
          failedAt: f.createdAt,
          retryCount: f.retryCount,
        })),
      },
    };
  }

  async retrySync(clinicId: number, dto: RetrySyncDto) {
    const qb = this.syncLogRepo
      .createQueryBuilder()
      .update(SatusehatSyncLog)
      .set({ status: SyncLogStatus.PENDING, lastRetryAt: new Date() })
      .where('clinicId = :clinicId AND status = :status', {
        clinicId,
        status: SyncLogStatus.FAILED,
      });

    if (dto.resourceType) {
      qb.andWhere('resourceType = :resourceType', {
        resourceType: dto.resourceType,
      });
    }
    if (dto.localIds && dto.localIds.length > 0) {
      qb.andWhere('localId IN (:...localIds)', { localIds: dto.localIds });
    }

    const result = await qb.execute();
    return {
      queued: result.affected || 0,
      message: 'Proses retry dimulai di background',
    };
  }
}
