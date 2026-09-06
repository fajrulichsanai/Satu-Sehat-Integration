import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SubscriptionPayment,
  SubscriptionPaymentStatus,
} from './entities/subscription-payment.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { ClinicSubscriptionsService } from './clinic-subscriptions.service';
import { SubscriptionPlansService } from './subscription-plans.service';
import { SubscriptionPlanTier } from './entities/subscription-plan.entity';
import {
  CreateSubscriptionPaymentDto,
  ReviewSubscriptionPaymentDto,
  SubscriptionPaymentQueryDto,
} from './dto/subscription-payment.dto';
import { PaginatedResult, paginate } from '../../common/dto/pagination.dto';
import { proofFileToUrl } from './upload/payment-proof.storage';

@Injectable()
export class SubscriptionPaymentsService {
  constructor(
    @InjectRepository(SubscriptionPayment)
    private readonly paymentRepository: Repository<SubscriptionPayment>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    private readonly subscriptionPlansService: SubscriptionPlansService,
    private readonly clinicSubscriptionsService: ClinicSubscriptionsService,
  ) {}

  async claim(
    clinicId: number,
    dto: CreateSubscriptionPaymentDto,
    createdBy: number,
    proof?: Express.Multer.File,
  ): Promise<SubscriptionPayment> {
    const plan = await this.subscriptionPlansService.findOne(dto.planId);
    // Quantity (clinic count) only makes sense for Multi Klinik — any value
    // sent for another tier is ignored so the amount can't be manipulated.
    const quantity =
      plan.tier === SubscriptionPlanTier.MULTI_KLINIK
        ? Math.max(1, dto.quantity ?? 1)
        : 1;
    const amount = Number(plan.price) * quantity + Number(plan.ownerFee ?? 0);
    const payment = this.paymentRepository.create({
      clinicId,
      planId: dto.planId,
      quantity,
      amount,
      status: SubscriptionPaymentStatus.PENDING,
      notes: dto.notes ?? null,
      proofUrl: proofFileToUrl(proof),
      createdBy,
    });
    return this.paymentRepository.save(payment);
  }

  private buildQuery(query: SubscriptionPaymentQueryDto, clinicId?: number) {
    const qb = this.paymentRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.plan', 'plan')
      .orderBy('p.createdAt', 'DESC');

    if (clinicId !== undefined) {
      qb.andWhere('p.clinicId = :clinicId', { clinicId });
    } else if (query.clinicId) {
      qb.andWhere('p.clinicId = :queryClinicId', {
        queryClinicId: query.clinicId,
      });
    }
    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }
    return qb;
  }

  async listMine(
    clinicId: number,
    query: SubscriptionPaymentQueryDto,
  ): Promise<PaginatedResult<SubscriptionPayment>> {
    return paginate(this.buildQuery(query, clinicId), query);
  }

  async listQueue(
    query: SubscriptionPaymentQueryDto,
  ): Promise<PaginatedResult<SubscriptionPayment & { clinicName?: string }>> {
    const result = await paginate(this.buildQuery(query), query);
    const clinicIds = [...new Set(result.data.map((p) => p.clinicId))];
    const clinics = clinicIds.length
      ? await this.clinicRepository.find({
          where: clinicIds.map((id) => ({ id })),
        })
      : [];
    const nameById = new Map(clinics.map((c) => [c.id, c.name]));
    return {
      ...result,
      data: result.data.map((p) => ({
        ...p,
        clinicName: nameById.get(p.clinicId),
      })),
    };
  }

  private async findPendingOrThrow(id: number): Promise<SubscriptionPayment> {
    const payment = await this.paymentRepository.findOne({ where: { id } });
    if (!payment) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'PAYMENT_NOT_FOUND',
          message: 'Klaim pembayaran tidak ditemukan',
        },
      });
    }
    if (payment.status !== SubscriptionPaymentStatus.PENDING) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'PAYMENT_ALREADY_REVIEWED',
          message: 'Klaim pembayaran ini sudah diproses',
        },
      });
    }
    return payment;
  }

  async confirm(
    id: number,
    dto: ReviewSubscriptionPaymentDto,
    superAdminId: number,
  ): Promise<SubscriptionPayment> {
    const payment = await this.findPendingOrThrow(id);

    const subscription =
      await this.clinicSubscriptionsService.extendSubscription(
        payment.clinicId,
        payment.planId,
        superAdminId,
        dto.notes,
      );

    payment.status = SubscriptionPaymentStatus.CONFIRMED;
    payment.subscriptionId = subscription.id;
    payment.confirmedBy = superAdminId;
    payment.confirmedAt = new Date();
    payment.updatedBy = superAdminId;
    if (dto.notes) payment.notes = dto.notes;
    return this.paymentRepository.save(payment);
  }

  async reject(
    id: number,
    dto: ReviewSubscriptionPaymentDto,
    superAdminId: number,
  ): Promise<SubscriptionPayment> {
    const payment = await this.findPendingOrThrow(id);
    payment.status = SubscriptionPaymentStatus.REJECTED;
    payment.confirmedBy = superAdminId;
    payment.confirmedAt = new Date();
    payment.updatedBy = superAdminId;
    if (dto.notes) payment.notes = dto.notes;
    return this.paymentRepository.save(payment);
  }
}
