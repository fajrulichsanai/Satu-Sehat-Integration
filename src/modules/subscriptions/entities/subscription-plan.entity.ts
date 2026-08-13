import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

@Entity('subscription_plans')
export class SubscriptionPlan extends BaseEntity {
  @Column({ length: 100 })
  name: string;

  @Column({ name: 'duration_days' })
  durationDays: number;

  @Column('decimal', { precision: 12, scale: 2 })
  price: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
