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
import { User } from '../users/entities/user.entity';
import { ClinicSubscriptionsService } from './clinic-subscriptions.service';
import { SubscriptionPlansService } from './subscription-plans.service';
import { SubscriptionPlanTier } from './entities/subscription-plan.entity';
import {
  ClaimOwnerSubscriptionPaymentDto,
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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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

  /**
   * A Multi-Klinik Owner pays once for every clinic currently linked to
   * their account — quantity is derived from linkedClinicIds (never trusted
   * from the client) and frozen into coveredClinicIds so confirmation later
   * extends exactly what was priced here.
   */
  async claimForOwner(
    ownerId: number,
    linkedClinicIds: number[],
    dto: ClaimOwnerSubscriptionPaymentDto,
    createdBy: number,
    proof?: Express.Multer.File,
  ): Promise<SubscriptionPayment> {
    if (linkedClinicIds.length === 0) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'NO_CLINICS_LINKED',
          message: 'Belum ada klinik yang dihubungkan ke akun Anda',
        },
      });
    }
    const plan = await this.subscriptionPlansService.findOne(dto.planId);
    if (plan.tier !== SubscriptionPlanTier.MULTI_KLINIK) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_PLAN_TIER',
          message: 'Akun Multi-Klinik Owner hanya bisa membayar paket Multi Klinik',
        },
      });
    }
    const quantity = linkedClinicIds.length;
    const amount = Number(plan.price) * quantity + Number(plan.ownerFee ?? 0);
    const payment = this.paymentRepository.create({
      clinicId: null,
      ownerId,
      planId: dto.planId,
      quantity,
      coveredClinicIds: linkedClinicIds,
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

  async listMineForOwner(
    ownerId: number,
    query: SubscriptionPaymentQueryDto,
  ): Promise<PaginatedResult<SubscriptionPayment>> {
    const qb = this.paymentRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.plan', 'plan')
      .where('p.ownerId = :ownerId', { ownerId })
      .orderBy('p.createdAt', 'DESC');
    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }
    return paginate(qb, query);
  }

  async listQueue(
    query: SubscriptionPaymentQueryDto,
  ): Promise<
    PaginatedResult<SubscriptionPayment & { clinicName?: string; ownerName?: string }>
  > {
    const result = await paginate(this.buildQuery(query), query);
    const clinicIds = [
      ...new Set(
        result.data.map((p) => p.clinicId).filter((id): id is number => typeof id === 'number'),
      ),
    ];
    const ownerIds = [
      ...new Set(
        result.data.map((p) => p.ownerId).filter((id): id is number => typeof id === 'number'),
      ),
    ];
    const [clinics, owners] = await Promise.all([
      clinicIds.length
        ? this.clinicRepository.find({ where: clinicIds.map((id) => ({ id })) })
        : Promise.resolve([]),
      ownerIds.length
        ? this.userRepository.find({ where: ownerIds.map((id) => ({ id })) })
        : Promise.resolve([]),
    ]);
    const clinicNameById = new Map(clinics.map((c) => [c.id, c.name]));
    const ownerNameById = new Map(owners.map((o) => [o.id, o.name]));
    return {
      ...result,
      data: result.data.map((p) => ({
        ...p,
        clinicName:
          typeof p.clinicId === 'number' ? clinicNameById.get(p.clinicId) : undefined,
        ownerName: typeof p.ownerId === 'number' ? ownerNameById.get(p.ownerId) : undefined,
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

    let firstSubscriptionId: number | null = null;
    if (payment.ownerId) {
      // Owner-scoped Multi Klinik payment — one confirmation extends every
      // clinic frozen into coveredClinicIds at claim time.
      for (const clinicId of payment.coveredClinicIds ?? []) {
        const subscription = await this.clinicSubscriptionsService.extendSubscription(
          clinicId,
          payment.planId,
          superAdminId,
          dto.notes,
        );
        if (firstSubscriptionId === null) firstSubscriptionId = subscription.id;
      }
    } else {
      const subscription = await this.clinicSubscriptionsService.extendSubscription(
        payment.clinicId as number,
        payment.planId,
        superAdminId,
        dto.notes,
      );
      firstSubscriptionId = subscription.id;
    }

    payment.status = SubscriptionPaymentStatus.CONFIRMED;
    payment.subscriptionId = firstSubscriptionId;
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
