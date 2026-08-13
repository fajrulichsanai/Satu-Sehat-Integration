import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { SubscriptionPlan } from './subscription-plan.entity';

// A subscription row is only ever created at confirm/extend time (see
// ClinicSubscriptionsService.extendSubscription), so it starts ACTIVE and the
// daily cron flips it to EXPIRED — there is no "pending" subscription state.
// The pending/awaiting-review state lives on SubscriptionPayment instead.
export enum ClinicSubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
}

/**
 * Append-only history: every extension/confirmation inserts a new row rather
 * than mutating an existing one, so a clinic's renewal history stays intact
 * for reporting/audit. "Current" subscription = latest row for the clinic.
 */
@Entity('clinic_subscriptions')
@Index(['clinicId', 'createdAt'])
export class ClinicSubscription extends BaseEntity {
  @Column({ name: 'clinic_id' })
  @Index()
  clinicId: number;

  @Column({ name: 'plan_id' })
  planId: number;

  @ManyToOne(() => SubscriptionPlan)
  @JoinColumn({ name: 'plan_id' })
  plan: SubscriptionPlan;

  @Column({ name: 'start_date', type: 'date' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date' })
  endDate: string;

  @Column({
    type: 'enum',
    enum: ClinicSubscriptionStatus,
    default: ClinicSubscriptionStatus.ACTIVE,
  })
  status: ClinicSubscriptionStatus;

  @Column({ name: 'extended_by', type: 'int', nullable: true })
  extendedBy: number | null;

  @Column('text', { nullable: true })
  notes: string | null;

  // Dedup flags so the daily expiry-warning cron sends each reminder once,
  // even though it re-evaluates every ACTIVE row every day.
  @Column({ name: 'notified_h7_at', type: 'datetime', nullable: true })
  notifiedH7At: Date | null;

  @Column({ name: 'notified_h1_at', type: 'datetime', nullable: true })
  notifiedH1At: Date | null;
}
