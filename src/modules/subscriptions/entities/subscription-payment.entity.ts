import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { SubscriptionPlan } from './subscription-plan.entity';

export enum SubscriptionPaymentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

/**
 * A clinic's "I've paid" claim against a static QR. Stays unlinked from any
 * ClinicSubscription until a super admin confirms it — confirmation is what
 * creates/extends the subscription row, so a rejected claim never leaves a
 * dangling subscription behind.
 */
@Entity('subscription_payments')
@Index(['clinicId', 'createdAt'])
export class SubscriptionPayment extends BaseEntity {
  @Column({ name: 'clinic_id' })
  @Index()
  clinicId: number;

  @Column({ name: 'plan_id' })
  planId: number;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlan;

  @Column({ name: 'subscription_id', type: 'int', nullable: true })
  subscriptionId: number | null;

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
