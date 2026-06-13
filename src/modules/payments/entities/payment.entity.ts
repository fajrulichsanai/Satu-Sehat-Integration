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
  billingId: number;

  @Column({ name: 'receipt_number', length: 50, unique: true })
  receiptNumber: string;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  method: PaymentMethod;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column('text', { nullable: true })
  note: string;

  @Column({ name: 'paid_at' })
  paidAt: Date;

  // Relations
  @ManyToOne(() => Billing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'billing_id' })
  billing: Billing;
}
