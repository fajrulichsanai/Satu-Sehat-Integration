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

    return {
      totalClinics,
      activeClinics,
      expiredClinics,
      pendingConfirmations,
      mrr,
      totalRevenue,
      revenueByPeriod,
      newClinicsByPeriod,
      planDistribution,
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
