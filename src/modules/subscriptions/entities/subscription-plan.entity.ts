import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

export enum SubscriptionPlanTier {
  TRIAL = 'trial',
  BASIC = 'basic',
  PRO = 'pro',
  MULTI_KLINIK = 'multi_klinik',
}

export enum SubscriptionBillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

@Entity('subscription_plans')
export class SubscriptionPlan extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ name: 'duration_days' })
  durationDays: number;

  // For BASIC/PRO this is the flat price for the cycle. For MULTI_KLINIK
  // this is the PER-CLINIC price — the payment's actual amount multiplies
  // this by the clinic quantity the owner enters at checkout (see
  // SubscriptionPaymentsService.claim).
  @Column('decimal', { precision: 12, scale: 2 })
  price: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Nullable so pre-existing plan rows (created before tiers existed) keep
  // working — they just won't render under any tier card on the pricing page.
  @Column({ type: 'varchar', length: 20, nullable: true })
  tier: SubscriptionPlanTier | null;

  @Column({
    name: 'billing_cycle',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  billingCycle: SubscriptionBillingCycle | null;

  // Flat one-time addition on top of price*quantity — used for MULTI_KLINIK's
  // owner admin fee. Zero/null for every other tier.
  @Column({
    name: 'owner_fee',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    default: 0,
  })
  ownerFee: number | null;

  // Jatah storage file layanan per klinik (GB). Null = bawaan tier — see
  // StorageQuotaService. For MULTI_KLINIK it is per branch, shared.
  // Desimal: 0.1 = 100 MB (masa coba).
  @Column({
    name: 'storage_gb',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (v: number | null | undefined) => v,
      from: (v: string | null) =>
        v === null || v === undefined ? null : Number(v),
    },
  })
  storageGb: number | null;

  // Batas akun aktif per klinik. Null = bawaan tier (Starter 5, Pro & masa
  // coba 25). For MULTI_KLINIK it is per branch, shared.
  @Column({ name: 'max_users', type: 'int', nullable: true })
  maxUsers: number | null;

  // Harga promo per bulan (per klinik untuk Multi Klinik), berlaku sampai
  // promoUntil (inklusif). `price` tetap harga normal ("harga asli").
  @Column('decimal', {
    name: 'promo_price',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  promoPrice: number | null;

  @Column({ name: 'promo_until', type: 'date', nullable: true })
  promoUntil: string | null;

  // Biaya admin owner Multi Klinik selama promo (null = ownerFee biasa).
  @Column('decimal', {
    name: 'promo_owner_fee',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  promoOwnerFee: number | null;
}
