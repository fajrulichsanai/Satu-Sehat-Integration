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
import {
  effectivePrice,
  quotePrice,
  today,
  type PriceQuote,
} from './limits/pricing';
import { DEFAULT_MAX_USERS, DEFAULT_STORAGE_GB } from './limits/plan-limits';

/** Urutan paket untuk naik/turun paket. Multi Klinik diurus lewat akun owner. */
const TIER_RANK: Record<string, number> = { trial: 0, basic: 1, pro: 2 };
const GB = 1000 ** 3;

export interface UpgradeQuote {
  allowed: boolean;
  reason: string | null;
  fromPlanId: number | null;
  fromPlanName: string | null;
  toPlanId: number;
  toPlanName: string;
  /** Paket baru berlaku mulai hari ini sampai `until` (akhir masa aktif). */
  from: string;
  until: string | null;
  remainingDays: number;
  /** Selisih harga per bulan (harga yang berlaku hari ini). */
  monthlyDifference: number;
  amount: number;
}

function daysInclusive(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000) + 1);
}
import { BillingSettingsService } from './billing-settings.service';
import { renderReceiptPdf } from './receipt-pdf';
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

  /**
   * Naik paket (Starter → Pro) di tengah masa aktif: bayar selisih harga
   * bulanan × sisa hari / 30, paket baru langsung berlaku setelah
   * dikonfirmasi; masa aktif tidak berubah.
   */
  async upgradeQuote(
    clinicId: number,
    planId: number,
    on = today(),
  ): Promise<UpgradeQuote> {
    const target = await this.subscriptionPlansService.findOne(planId);
    const current = await this.clinicSubscriptionsService.getInEffectForClinic(
      clinicId,
      on,
    );
    const base: UpgradeQuote = {
      allowed: false,
      reason: null,
      fromPlanId: current?.planId ?? null,
      fromPlanName: current?.plan?.name ?? null,
      toPlanId: target.id,
      toPlanName: target.name,
      from: on,
      until: null,
      remainingDays: 0,
      monthlyDifference: 0,
      amount: 0,
    };
    const targetRank = TIER_RANK[target.tier ?? ''];
    const currentRank = TIER_RANK[current?.plan?.tier ?? ''];
    if (
      !current ||
      currentRank === undefined ||
      current.plan?.tier === SubscriptionPlanTier.TRIAL
    ) {
      return {
        ...base,
        reason:
          'Belum ada langganan berbayar yang aktif. Pilih paket seperti biasa.',
      };
    }
    if (targetRank === undefined || targetRank <= currentRank) {
      return {
        ...base,
        reason: 'Paket tujuan tidak lebih tinggi dari paket sekarang.',
      };
    }
    if (await this.isSelfPayingBranch(clinicId)) {
      return {
        ...base,
        reason: 'Cabang multiklinik tidak bisa naik paket dari sini.',
      };
    }
    const until = await this.clinicSubscriptionsService.paidUntil(clinicId);
    const remainingDays = until ? daysInclusive(on, until) : 0;
    const monthlyDifference = Math.max(
      0,
      effectivePrice(target, on) - effectivePrice(current.plan!, on),
    );
    // Dibulatkan ke ratusan rupiah.
    const amount =
      Math.round((monthlyDifference * remainingDays) / 30 / 100) * 100;
    return {
      ...base,
      allowed: remainingDays > 0,
      until,
      remainingDays,
      monthlyDifference,
      amount,
    };
  }

  /**
   * Turun paket berlaku periode berikutnya dan ditolak bila akun aktif atau
   * storage terpakai melebihi batas paket tujuan (keputusan tagihan PRD).
   */
  private async assertDowngradeFits(clinicId: number, plan: SubscriptionPlan) {
    const current =
      await this.clinicSubscriptionsService.getInEffectForClinic(clinicId);
    const currentRank = TIER_RANK[current?.plan?.tier ?? ''];
    const targetRank = TIER_RANK[plan.tier ?? ''];
    if (
      currentRank === undefined ||
      targetRank === undefined ||
      current?.plan?.tier === SubscriptionPlanTier.TRIAL
    )
      return;
    if (targetRank >= currentRank) return;
    const maxUsers =
      plan.maxUsers ?? DEFAULT_MAX_USERS[plan.tier ?? 'basic'] ?? 5;
    const [row] = (await this.clinicRepository.manager.query(
      "SELECT COUNT(*) AS n FROM users WHERE clinic_id = ? AND is_active = 1 AND role <> 'pending'",
      [clinicId],
    )) as { n: number }[];
    const activeUsers = Number(row?.n ?? 0);
    if (activeUsers > maxUsers) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'DOWNGRADE_TOO_MANY_USERS',
          message: `Paket ${plan.name} hanya untuk ${maxUsers} akun aktif, sekarang ada ${activeUsers}. Nonaktifkan ${activeUsers - maxUsers} akun dulu di User Management.`,
        },
      });
    }
    const quota = await this.storageQuota?.quotaForClinic(clinicId);
    if (quota && quota.scope === 'clinic') {
      const storageGb =
        plan.storageGb ?? DEFAULT_STORAGE_GB[plan.tier ?? 'basic'] ?? 1;
      const limitBytes = (Number(storageGb) + quota.extraGb) * GB;
      if (quota.usedBytes > limitBytes) {
        throw new BadRequestException({
          success: false,
          error: {
            code: 'DOWNGRADE_STORAGE_TOO_BIG',
            message: `Storage terpakai melebihi jatah paket ${plan.name} (${storageGb} GB + ${quota.extraGb} GB tambahan). Hapus file yang tidak dipakai atau beli storage tambahan dulu.`,
          },
        });
      }
    }
  }

  async claim(
    clinicId: number,
    dto: CreateSubscriptionPaymentDto,
    createdBy: number,
    proof?: Express.Multer.File,
  ): Promise<SubscriptionPayment> {
    if (dto.kind === 'upgrade') {
      const upgrade = await this.upgradeQuote(clinicId, dto.planId);
      if (!upgrade.allowed) {
        throw new BadRequestException({
          success: false,
          error: {
            code: 'UPGRADE_NOT_ALLOWED',
            message: upgrade.reason ?? 'Tidak bisa naik paket',
          },
        });
      }
      const saved = await this.paymentRepository.save(
        this.paymentRepository.create({
          clinicId,
          planId: dto.planId,
          kind: 'upgrade',
          quantity: 1,
          months: 0,
          amount: upgrade.amount,
          status: SubscriptionPaymentStatus.PENDING,
          notes:
            dto.notes ??
            `Naik paket dari ${upgrade.fromPlanName} ke ${upgrade.toPlanName}, ${upgrade.remainingDays} hari (s.d. ${upgrade.until})`,
          proofUrl: proofFileToUrl(proof),
          createdBy,
        }),
      );
      return toApiUrl(saved);
    }
    await this.assertDowngradeFits(
      clinicId,
      await this.subscriptionPlansService.findOne(dto.planId),
    );
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
      kind: payment.kind ?? 'new',
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

  /** Kuitansi sebagai PDF (unduh, dan lampiran email saat dikonfirmasi). */
  async receiptPdf(
    id: number,
    scope: { clinicId?: number | null; ownerId?: number },
  ): Promise<{ fileName: string; pdf: Buffer }> {
    const data = await this.receipt(id, scope);
    return {
      fileName: `kuitansi-${data.number}.pdf`,
      pdf: await renderReceiptPdf(data),
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
    } else if (payment.kind === 'upgrade') {
      // Naik paket: tidak menambah masa aktif, hanya mengganti paketnya.
      const upgraded = await this.clinicSubscriptionsService.applyUpgrade(
        payment.clinicId as number,
        payment.planId,
        superAdminId,
      );
      if (!upgraded) {
        throw new BadRequestException({
          success: false,
          error: {
            code: 'UPGRADE_NO_ACTIVE_SUBSCRIPTION',
            message:
              'Klinik ini tidak punya langganan aktif lagi. Tolak klaim ini dan minta klinik membeli paket baru.',
          },
        });
      }
      firstSubscriptionId = upgraded.id;
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
    // Kuitansi PDF ke pembayar (SA-02). Fire-and-forget: never undoes the confirm.
    void this.receiptPdf(saved.id, { clinicId: null })
      .catch(() => undefined)
      .then((attachment) =>
        this.notifications?.sendPaymentReceipt(saved, attachment),
      );
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
