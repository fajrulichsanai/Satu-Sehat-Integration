import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ClinicSubscription,
  ClinicSubscriptionStatus,
} from './entities/clinic-subscription.entity';
import {
  SubscriptionPayment,
  SubscriptionPaymentStatus,
} from './entities/subscription-payment.entity';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { SuperAdminReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class SuperAdminReportsService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(ClinicSubscription)
    private readonly clinicSubscriptionRepository: Repository<ClinicSubscription>,
    @InjectRepository(SubscriptionPayment)
    private readonly paymentRepository: Repository<SubscriptionPayment>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepository: Repository<SubscriptionPlan>,
  ) {}

  async summary(query: SuperAdminReportQueryDto) {
    const totalClinics = await this.clinicRepository.count();

    const clinics = await this.clinicRepository.find();
    const latestPerClinic = await this.latestByClinicIds(
      clinics.map((c) => c.id),
    );
    let activeClinics = 0;
    let expiredClinics = 0;
    for (const clinic of clinics) {
      const sub = latestPerClinic.get(clinic.id);
      if (sub?.status === ClinicSubscriptionStatus.ACTIVE) activeClinics += 1;
      else expiredClinics += 1;
    }

    const pendingConfirmations = await this.paymentRepository.count({
      where: { status: SubscriptionPaymentStatus.PENDING },
    });

    const confirmedQb = this.paymentRepository
      .createQueryBuilder('p')
      .where('p.status = :status', {
        status: SubscriptionPaymentStatus.CONFIRMED,
      });
    if (query.dateFrom)
      confirmedQb.andWhere('p.confirmedAt >= :dateFrom', {
        dateFrom: query.dateFrom,
      });
    if (query.dateTo)
      confirmedQb.andWhere('p.confirmedAt <= :dateTo', {
        dateTo: query.dateTo,
      });
    const confirmedPayments = await confirmedQb.getMany();

    const totalRevenue = confirmedPayments.reduce(
      (sum, p) => sum + Number(p.amount),
      0,
    );
    const mrr = this.estimateMrr(activeClinics, confirmedPayments);

    const revenueByPeriod = this.groupByMonth(
      confirmedPayments,
      (p) => p.confirmedAt!,
      (p) => Number(p.amount),
    ).map(({ period, value }) => ({ period, revenue: value }));

    const newClinicsByPeriod = this.groupByMonth(
      clinics,
      (c) => c.createdAt,
      () => 1,
    ).map(({ period, value }) => ({
      period,
      count: value,
    }));

    const plans = await this.planRepository.find();
    const planDistribution = plans.map((plan) => ({
      planId: plan.id,
      planName: plan.name,
      count: [...latestPerClinic.values()].filter(
        (sub) =>
          sub.status === ClinicSubscriptionStatus.ACTIVE &&
          sub.planId === plan.id,
      ).length,
    }));

    const now = new Date();
    const newClinicsThisMonth = clinics.filter(
      (c) =>
        c.createdAt &&
        c.createdAt.getFullYear() === now.getFullYear() &&
        c.createdAt.getMonth() === now.getMonth(),
    ).length;

    return {
      totalClinics,
      activeClinics,
      newClinicsThisMonth,
      expiredClinics,
      pendingConfirmations,
      mrr,
      totalRevenue,
      revenueByPeriod,
      newClinicsByPeriod,
      planDistribution,
    };
  }

  /**
   * Antrian kerja Super Admin untuk sidebar dan blok "Perlu tindakan" di
   * Dashboard (PRD DB-01, UM-01): pembayaran menunggu, permintaan data
   * terbuka/lewat 3×24 jam, langganan habis ≤ 7 hari, jadwal hapus data, dan
   * klinik yang SATUSEHAT-nya belum siap (hanya bila saklar global menyala).
   */
  async queue() {
    const q = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
      this.clinicRepository.manager.query(sql, params);
    const today = new Date();
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    const overdueBefore = new Date(Date.now() - 72 * 3600 * 1000);

    const [
      payments,
      requests,
      expiring,
      deletions,
      global,
      notReady,
      followUps,
    ] = await Promise.all([
      this.paymentRepository.count({
        where: { status: SubscriptionPaymentStatus.PENDING },
      }),
      q<{ open: number; overdue: number }>(
        `SELECT COUNT(*) AS open, COALESCE(SUM(created_at < ?), 0) AS overdue
             FROM data_requests WHERE status IN ('pending', 'in_progress')`,
        [overdueBefore],
      ),
      q<{
        clinicId: number;
        clinicName: string;
        endDate: string;
        tier: string | null;
      }>(
        `SELECT c.id AS clinicId, c.name AS clinicName,
                  DATE_FORMAT(s.end_date, '%Y-%m-%d') AS endDate, p.tier AS tier
             FROM clinics c
             JOIN clinic_subscriptions s ON s.id = (
               SELECT s2.id FROM clinic_subscriptions s2 WHERE s2.clinic_id = c.id
                ORDER BY s2.end_date DESC, s2.id DESC LIMIT 1)
             LEFT JOIN subscription_plans p ON p.id = s.plan_id
            WHERE c.data_purged_at IS NULL AND s.status = 'active'
              AND s.end_date >= ? AND s.end_date <= ?
            ORDER BY s.end_date ASC`,
        [iso(today), iso(in7)],
      ),
      q<{ clinicId: number; clinicName: string; deleteAfter: string }>(
        `SELECT id AS clinicId, name AS clinicName,
                  DATE_FORMAT(data_delete_after, '%Y-%m-%d') AS deleteAfter
             FROM clinics
            WHERE data_delete_after IS NOT NULL AND data_purged_at IS NULL
            ORDER BY data_delete_after ASC`,
      ),
      q<{ value: string }>(
        "SELECT value FROM platform_settings WHERE setting_key = 'satusehat.enabled'",
      ),
      q<{ n: number }>(
        `SELECT COUNT(*) AS n FROM clinics c
            WHERE c.data_purged_at IS NULL
              AND (c.satusehat_client_id IS NULL OR c.satusehat_org_id IS NULL)
              AND NOT EXISTS (SELECT 1 FROM clinic_features f WHERE f.clinic_id = c.id
                               AND f.feature_key = 'satusehat' AND f.enabled = 0)`,
      ),
      // Tindak lanjut catatan internal yang jatuh tempo (PRD UP-06).
      q<{
        id: number;
        clinicId: number;
        clinicName: string;
        body: string;
        followUpOn: string;
      }>(
        `SELECT n.id, n.clinic_id AS clinicId, c.name AS clinicName, n.body,
                  DATE_FORMAT(n.follow_up_on, '%Y-%m-%d') AS followUpOn
             FROM clinic_admin_notes n JOIN clinics c ON c.id = n.clinic_id
            WHERE n.done_at IS NULL AND n.follow_up_on IS NOT NULL AND n.follow_up_on <= ?
            ORDER BY n.follow_up_on ASC LIMIT 20`,
        [iso(today)],
      ).catch(() => []),
    ]);
    const daysLeft = (date: string) =>
      Math.round(
        (new Date(`${date}T00:00:00`).getTime() -
          new Date(`${iso(today)}T00:00:00`).getTime()) /
          86_400_000,
      );
    const open = Number(requests[0]?.open ?? 0);
    const overdue = Number(requests[0]?.overdue ?? 0);
    return {
      pendingPayments: payments,
      openDataRequests: open,
      overdueDataRequests: overdue,
      satusehatNotReady:
        global[0]?.value === 'true' ? Number(notReady[0]?.n ?? 0) : 0,
      expiringSoon: expiring.map((e) => ({
        ...e,
        clinicId: Number(e.clinicId),
        daysLeft: daysLeft(e.endDate),
      })),
      followUps: followUps.map((f) => ({
        ...f,
        id: Number(f.id),
        clinicId: Number(f.clinicId),
      })),
      dataDeletions: deletions.map((d) => ({
        ...d,
        clinicId: Number(d.clinicId),
        daysLeft: daysLeft(d.deleteAfter),
      })),
    };
  }

  /** Rough MRR: revenue from the last 30 days of confirmed payments, normalized to a monthly figure. */
  private estimateMrr(
    activeClinics: number,
    confirmedPayments: SubscriptionPayment[],
  ): number {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return confirmedPayments
      .filter((p) => p.confirmedAt && p.confirmedAt >= thirtyDaysAgo)
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }

  private groupByMonth<T>(
    items: T[],
    getDate: (item: T) => Date,
    getValue: (item: T) => number,
  ) {
    const map = new Map<string, number>();
    for (const item of items) {
      const date = getDate(item);
      if (!date) continue;
      const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      map.set(period, (map.get(period) ?? 0) + getValue(item));
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, value]) => ({ period, value }));
  }

  private async latestByClinicIds(
    clinicIds: number[],
  ): Promise<Map<number, ClinicSubscription>> {
    if (clinicIds.length === 0) return new Map();
    const rows = await this.clinicSubscriptionRepository.find({
      where: clinicIds.map((clinicId) => ({ clinicId })),
      order: { id: 'DESC' },
    });
    const map = new Map<number, ClinicSubscription>();
    for (const row of rows) {
      if (!map.has(row.clinicId)) map.set(row.clinicId, row);
    }
    return map;
  }
}
