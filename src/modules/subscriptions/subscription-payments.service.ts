import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { existsSync } from 'fs';
import { join } from 'path';
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
import {
  BranchBillingMode,
  OwnerClinicLink,
  OwnerClinicLinkStatus,
} from '../multi-clinic/entities/owner-clinic-link.entity';
import { SubscriptionNotificationsService } from './subscription-notifications.service';
import { StorageQuotaService } from '../storage-quota/storage-quota.service';
import { quotePrice, type PriceQuote } from './limits/pricing';
import { BillingSettingsService } from './billing-settings.service';
import type { SubscriptionPlan } from './entities/subscription-plan.entity';

function toApiUrl(payment: SubscriptionPayment): SubscriptionPayment {
  if (!payment.proofUrl) return payment;
  return {
    ...payment,
    proofUrl: `/subscription-payments/${payment.id}/proof-file`,
  };
}

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
    @Optional()
    @InjectRepository(OwnerClinicLink)
    private readonly linkRepository?: Repository<OwnerClinicLink>,
    @Optional()
    private readonly notifications?: SubscriptionNotificationsService,
    @Optional() private readonly storageQuota?: StorageQuotaService,
    @Optional() private readonly billingSettings?: BillingSettingsService,
  ) {}

  private async discounts() {
    return this.billingSettings?.getDurationDiscounts();
  }

  /** The amount columns a payment stores, from a quote. */
  private amountsOf(quote: PriceQuote) {
    return {
      quantity: quote.quantity,
      months: quote.months,
      amount: quote.total,
      promoDiscount: quote.promoDiscount,
      durationDiscount: quote.durationDiscount,
      extraStorageGb: quote.extraStorageGb,
      storageAmount: quote.storageAmount,
    };
  }

  /**
   * Rincian tagihan untuk klinik ini: paket (promo bila aktif) × bulan,
   * diskon lama langganan, dan storage tambahan. Same function the claim
   * uses, so the preview always matches what gets billed.
   */
  async quoteForClinic(
    clinicId: number,
    planId: number,
    months = 1,
    requestedQuantity = 1,
  ): Promise<{ plan: SubscriptionPlan; quote: PriceQuote }> {
    const plan = await this.subscriptionPlansService.findOne(planId);
    // Quantity (clinic count) only makes sense for Multi Klinik — any value
    // sent for another tier is ignored so the amount can't be manipulated.
    const selfPayingBranch =
      plan.tier === SubscriptionPlanTier.MULTI_KLINIK &&
      (await this.isSelfPayingBranch(clinicId));
    const quantity =
      plan.tier === SubscriptionPlanTier.MULTI_KLINIK && !selfPayingBranch
        ? Math.max(1, requestedQuantity)
        : 1;
    const quote = quotePrice({
      plan,
      months,
      quantity,
      ownerFee: selfPayingBranch ? 0 : Number(plan.ownerFee ?? 0),
      // One bill per period: plan + storage tambahan (PRD Super Admin BL-06).
      extraStorageGb:
        (await this.storageQuota?.extraGbToBillForClinic(clinicId)) ?? 0,
      discounts: await this.discounts(),
    });
    return { plan, quote };
  }

  /** Rincian tagihan gabungan owner multiklinik untuk cabang yang ditanggungnya. */
  async quoteForOwner(
    ownerId: number,
    clinicIds: number[],
    planId: number,
    months = 1,
  ): Promise<{ plan: SubscriptionPlan; quote: PriceQuote }> {
    const plan = await this.subscriptionPlansService.findOne(planId);
    if (plan.tier !== SubscriptionPlanTier.MULTI_KLINIK) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_PLAN_TIER',
          message:
            'Akun Multi-Klinik Owner hanya bisa membayar paket Multi Klinik',
        },
      });
    }
    const quote = quotePrice({
      plan,
      months,
      quantity: Math.max(1, clinicIds.length),
      ownerFee: Number(plan.ownerFee ?? 0),
      // Storage tambahan jatah bersama ikut tagihan owner.
      extraStorageGb:
        (await this.storageQuota?.billableExtraGb({ ownerId })) ?? 0,
      discounts: await this.discounts(),
    });
    return { plan, quote };
  }

  /**
   * A branch linked to a Multi-Klinik Owner that pays for itself (PRD:
   * "Dibayar sendiri oleh manajer cabang") pays the per-branch Multi Klinik
   * price — one branch, no owner fee.
   */
  private async isSelfPayingBranch(clinicId: number): Promise<boolean> {
    const link = await this.linkRepository?.findOne({
      where: {
        clinicId,
        status: OwnerClinicLinkStatus.APPROVED,
        billingMode: BranchBillingMode.SELF,
      },
    });
    return !!link;
  }

  async claim(
    clinicId: number,
    dto: CreateSubscriptionPaymentDto,
    createdBy: number,
    proof?: Express.Multer.File,
  ): Promise<SubscriptionPayment> {
    const { quote } = await this.quoteForClinic(
      clinicId,
      dto.planId,
      dto.months ?? 1,
      dto.quantity ?? 1,
    );
    const payment = this.paymentRepository.create({
      clinicId,
      planId: dto.planId,
      ...this.amountsOf(quote),
      status: SubscriptionPaymentStatus.PENDING,
      notes: dto.notes ?? null,
      proofUrl: proofFileToUrl(proof),
      createdBy,
    });
    const saved = await this.paymentRepository.save(payment);
    return toApiUrl(saved);
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
    const { quote } = await this.quoteForOwner(
      ownerId,
      linkedClinicIds,
      dto.planId,
      dto.months ?? 1,
    );
    const payment = this.paymentRepository.create({
      clinicId: null,
      ownerId,
      planId: dto.planId,
      ...this.amountsOf(quote),
      coveredClinicIds: linkedClinicIds,
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
    const result = await paginate(this.buildQuery(query, clinicId), query);
    return { ...result, data: result.data.map(toApiUrl) };
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
    const result = await paginate(qb, query);
    return {
      ...result,
      data: result.data.map((p) =>
        p.proofUrl
          ? { ...p, proofUrl: `/multi-clinic/payments/${p.id}/proof-file` }
          : p,
      ),
    };
  }

  async listQueue(
    query: SubscriptionPaymentQueryDto,
  ): Promise<
    PaginatedResult<
      SubscriptionPayment & { clinicName?: string; ownerName?: string }
    >
  > {
    const result = await paginate(this.buildQuery(query), query);
    const clinicIds = [
      ...new Set(
        result.data
          .map((p) => p.clinicId)
          .filter((id): id is number => typeof id === 'number'),
      ),
    ];
    const ownerIds = [
      ...new Set(
        result.data
          .map((p) => p.ownerId)
          .filter((id): id is number => typeof id === 'number'),
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
        ...toApiUrl(p),
        clinicName:
          typeof p.clinicId === 'number'
            ? clinicNameById.get(p.clinicId)
            : undefined,
        ownerName:
          typeof p.ownerId === 'number'
            ? ownerNameById.get(p.ownerId)
            : undefined,
      })),
    };
  }

  /**
   * Data kuitansi pembayaran yang sudah dikonfirmasi ("Lunas, dikonfirmasi"),
   * untuk dicetak/disimpan PDF dari browser. clinicId null = Super Admin;
   * ownerId = Multi-Klinik Owner untuk tagihan gabungannya.
   */
  async receipt(
    id: number,
    scope: { clinicId?: number | null; ownerId?: number },
  ) {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: { plan: true },
    });
    const allowed =
      !!payment &&
      (scope.ownerId !== undefined
        ? payment.ownerId === scope.ownerId
        : scope.clinicId === null || payment.clinicId === scope.clinicId);
    if (
      !payment ||
      !allowed ||
      payment.status !== SubscriptionPaymentStatus.CONFIRMED
    ) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'RECEIPT_NOT_FOUND',
          message:
            'Kuitansi hanya tersedia untuk pembayaran yang sudah dikonfirmasi',
        },
      });
    }
    const clinicIds = payment.clinicId
      ? [payment.clinicId]
      : (payment.coveredClinicIds ?? []);
    const clinics = clinicIds.length
      ? await this.clinicRepository.find({ where: { id: In(clinicIds) } })
      : [];
    const payer = payment.ownerId
      ? await this.userRepository.findOne({ where: { id: payment.ownerId } })
      : null;
    return {
      number: `APX-${String(payment.id).padStart(6, '0')}`,
      status: 'Lunas, dikonfirmasi',
      paymentId: payment.id,
      confirmedAt: payment.confirmedAt,
      createdAt: payment.createdAt,
      planName: payment.plan?.name ?? null,
      quantity: payment.quantity,
      months: payment.months ?? 1,
      amount: Number(payment.amount),
      promoDiscount: Number(payment.promoDiscount ?? 0),
      durationDiscount: Number(payment.durationDiscount ?? 0),
      extraStorageGb: Number(payment.extraStorageGb ?? 0),
      storageAmount: Number(payment.storageAmount ?? 0),
      billedTo: payer
        ? { name: payer.name, email: payer.email }
        : clinics[0]
          ? { name: clinics[0].name, email: clinics[0].email ?? null }
          : null,
      clinics: clinics.map((c) => ({ id: c.id, name: c.name })),
    };
  }

  async getProofFilePath(id: number, clinicId: number | null): Promise<string> {
    return this.resolveProofFile(
      id,
      (p) => clinicId === null || p.clinicId === clinicId,
    );
  }

  /** A Multi-Klinik Owner's own combined payment proof (owner-scoped). */
  async getOwnerProofFilePath(id: number, ownerId: number): Promise<string> {
    return this.resolveProofFile(id, (p) => p.ownerId === ownerId);
  }

  private async resolveProofFile(
    id: number,
    canView: (payment: SubscriptionPayment) => boolean,
  ): Promise<string> {
    const payment = await this.paymentRepository.findOne({ where: { id } });
    if (!payment || !payment.proofUrl) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'PAYMENT_PROOF_NOT_FOUND',
          message: 'Bukti pembayaran tidak ditemukan',
        },
      });
    }
    // A SUPER_ADMIN caller (clinicId === null) may view any clinic's proof.
    if (!canView(payment)) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'PAYMENT_PROOF_NOT_FOUND',
          message: 'Bukti pembayaran tidak ditemukan',
        },
      });
    }
    const absolutePath = join(
      process.cwd(),
      payment.proofUrl.replace(/^\//, ''),
    );
    if (!existsSync(absolutePath)) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'PAYMENT_PROOF_NOT_FOUND',
          message: 'File bukti pembayaran tidak ditemukan',
        },
      });
    }
    return absolutePath;
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
        const subscription =
          await this.clinicSubscriptionsService.extendSubscription(
            clinicId,
            payment.planId,
            superAdminId,
            dto.notes,
            payment.months ?? 1,
          );
        if (firstSubscriptionId === null) firstSubscriptionId = subscription.id;
      }
    } else {
      const subscription =
        await this.clinicSubscriptionsService.extendSubscription(
          payment.clinicId as number,
          payment.planId,
          superAdminId,
          dto.notes,
          payment.months ?? 1,
        );
      firstSubscriptionId = subscription.id;
    }

    payment.status = SubscriptionPaymentStatus.CONFIRMED;
    payment.subscriptionId = firstSubscriptionId;
    payment.confirmedBy = superAdminId;
    payment.confirmedAt = new Date();
    payment.updatedBy = superAdminId;
    if (dto.notes) payment.notes = dto.notes;
    const saved = await this.paymentRepository.save(payment);
    // Kuitansi ke pembayar (SA-02). Fire-and-forget: never undoes the confirm.
    void this.notifications?.sendPaymentReceipt(saved);
    return saved;
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
