import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ClinicSubscription,
  ClinicSubscriptionStatus,
} from './entities/clinic-subscription.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { SubscriptionPlansService } from './subscription-plans.service';
import { ClinicSubscriptionQueryDto } from './dto/clinic-subscription.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';

export interface ClinicSubscriptionSummary {
  clinicId: number;
  clinicName: string;
  subscription: ClinicSubscription | null;
}

@Injectable()
export class ClinicSubscriptionsService {
  constructor(
    @InjectRepository(ClinicSubscription)
    private readonly clinicSubscriptionRepository: Repository<ClinicSubscription>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  /** Latest row for a clinic represents its current subscription (see entity docblock). */
  getCurrentForClinic(clinicId: number): Promise<ClinicSubscription | null> {
    return this.clinicSubscriptionRepository.findOne({
      where: { clinicId },
      order: { id: 'DESC' },
      relations: { plan: true },
    });
  }

  getHistoryForClinic(clinicId: number): Promise<ClinicSubscription[]> {
    return this.clinicSubscriptionRepository.find({
      where: { clinicId },
      order: { id: 'DESC' },
      relations: { plan: true },
    });
  }

  private async latestByClinicIds(
    clinicIds: number[],
  ): Promise<Map<number, ClinicSubscription>> {
    if (clinicIds.length === 0) return new Map();
    const rows = await this.clinicSubscriptionRepository.find({
      where: clinicIds.map((clinicId) => ({ clinicId })),
      order: { id: 'DESC' },
      relations: { plan: true },
    });
    const map = new Map<number, ClinicSubscription>();
    for (const row of rows) {
      if (!map.has(row.clinicId)) map.set(row.clinicId, row);
    }
    return map;
  }

  async listAll(
    query: ClinicSubscriptionQueryDto,
  ): Promise<PaginatedResult<ClinicSubscriptionSummary>> {
    const { page, limit, status, search } = query;

    const clinicsQb = this.clinicRepository
      .createQueryBuilder('c')
      .orderBy('c.name', 'ASC');
    if (search) {
      clinicsQb.andWhere('c.name LIKE :search', { search: `%${search}%` });
    }
    const clinics = await clinicsQb.getMany();
    const latest = await this.latestByClinicIds(clinics.map((c) => c.id));

    let rows: ClinicSubscriptionSummary[] = clinics.map((c) => ({
      clinicId: c.id,
      clinicName: c.name,
      subscription: latest.get(c.id) ?? null,
    }));

    if (status) {
      rows = rows.filter((r) => r.subscription?.status === status);
    }

    const total = rows.length;
    const start = (page - 1) * limit;
    const data = rows.slice(start, start + limit);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Creates a new active subscription row for the clinic, stacking on top of
   * the current end date if still active (or starting from today otherwise).
   * Shared by the manual super-admin extend flow and payment confirmation.
   */
  async extendSubscription(
    clinicId: number,
    planId: number,
    extendedBy: number,
    notes?: string | null,
  ): Promise<ClinicSubscription> {
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });
    if (!clinic) {
      throw new NotFoundException({
        success: false,
        error: { code: 'CLINIC_NOT_FOUND', message: 'Klinik tidak ditemukan' },
      });
    }

    const plan = await this.subscriptionPlansService.findOne(planId);
    const current = await this.getCurrentForClinic(clinicId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentEnd =
      current?.status === ClinicSubscriptionStatus.ACTIVE
        ? new Date(`${current.endDate}T00:00:00`)
        : null;
    const base = currentEnd && currentEnd > today ? currentEnd : today;

    const endDate = new Date(base);
    endDate.setDate(endDate.getDate() + plan.durationDays);

    const row = this.clinicSubscriptionRepository.create({
      clinicId,
      planId,
      startDate: base.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      status: ClinicSubscriptionStatus.ACTIVE,
      extendedBy,
      notes: notes ?? null,
      createdBy: extendedBy,
    });
    const saved = await this.clinicSubscriptionRepository.save(row);
    const withPlan = await this.clinicSubscriptionRepository.findOne({
      where: { id: saved.id },
      relations: { plan: true },
    });
    return withPlan!;
  }

  /** Flips any active-but-lapsed row to expired. Run daily by the cron job. */
  async expireLapsedSubscriptions(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const result = await this.clinicSubscriptionRepository
      .createQueryBuilder()
      .update(ClinicSubscription)
      .set({ status: ClinicSubscriptionStatus.EXPIRED })
      .where('status = :active', { active: ClinicSubscriptionStatus.ACTIVE })
      .andWhere('end_date < :today', { today })
      .execute();
    return result.affected ?? 0;
  }
}
