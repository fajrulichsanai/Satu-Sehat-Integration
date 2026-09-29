import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { SubscriptionPlan } from './subscription-plan.entity';

export enum SubscriptionPaymentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

/**
 * A "I've paid" claim against a static QR — either from a single clinic
 * (clinicId set, ownerId null) or from a MULTI_CLINIC_OWNER account paying
 * once for every clinic currently linked to it (ownerId set, clinicId null,
 * coveredClinicIds frozen at claim time). Stays unlinked from any
 * ClinicSubscription until a super admin confirms it — confirmation is what
 * creates/extends the subscription row(s), so a rejected claim never leaves
 * a dangling subscription behind.
 */
@Entity('subscription_payments')
@Index(['clinicId', 'createdAt'])
export class SubscriptionPayment extends BaseEntity {
  @Column({ name: 'clinic_id', type: 'int', nullable: true })
  @Index()
  clinicId: number | null;

  // Set instead of clinicId for a Multi-Klinik Owner's own consolidated
  // payment — see coveredClinicIds below.
  @Column({ name: 'owner_id', type: 'int', nullable: true })
  @Index()
  ownerId: number | null;

  @Column({ name: 'plan_id' })
  planId: number;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlan;

  @Column({ name: 'subscription_id', type: 'int', nullable: true })
  subscriptionId: number | null;

  // For a clinic payment this is always 1. For an owner-scoped MULTI_KLINIK
  // payment it's the number of clinics linked to the owner at claim time
  // (== coveredClinicIds.length) — the owner pays once and every one of
  // those clinics' subscriptions is extended on confirmation.
  @Column({ type: 'int', default: 1 })
  quantity: number;

  // Snapshot of the owner's linked clinic ids at claim time (owner-scoped
  // payments only). Frozen here — rather than re-derived live from
  // owner_clinic_links on confirm — so what gets extended always matches
  // what was priced, even if links change while the claim is pending.
  @Column({ name: 'covered_clinic_ids', type: 'json', nullable: true })
  coveredClinicIds: number[] | null;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: SubscriptionPaymentStatus,
    default: SubscriptionPaymentStatus.PENDING,
  })
  @Index()
  status: SubscriptionPaymentStatus;

  @Column({ name: 'confirmed_by', type: 'int', nullable: true })
  confirmedBy: number | null;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmedAt: Date | null;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column({ name: 'proof_url', type: 'varchar', length: 500, nullable: true })
  proofUrl: string | null;
}
