import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Billing } from '../../billing/entities/billing.entity';

export enum PaymentMethod {
  CASH = 'cash',
  TRANSFER = 'transfer',
  INSURANCE = 'insurance',
  BPJS = 'bpjs',
}

@Entity('payments')
@Index(['receiptNumber'], { unique: true })
export class Payment extends BaseEntity {
  @Column({ name: 'billing_id' })
  billingId: number | undefined;

  @Column({ name: 'receipt_number', length: 50, unique: true })
  receiptNumber: string | undefined;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  method: PaymentMethod | undefined;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number | undefined;

  @Column('text', { nullable: true })
  note: string | undefined;

  @Column({ name: 'paid_at' })
  paidAt: Date | undefined;

  // Relations
  @ManyToOne(() => Billing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'billing_id' })
  billing: Billing | undefined;
}
