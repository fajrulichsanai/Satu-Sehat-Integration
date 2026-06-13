import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Billing } from '../../billing/entities/billing.entity';
import { Tarif } from '../../tarif/entities/tarif.entity';

export enum DiscountType {
  NOMINAL = 'nominal',
  PERCENT = 'percent',
}

@Entity('billing_items')
export class BillingItem extends BaseEntity {
  @Column({ name: 'billing_id' })
  billingId: number | undefined;

  @Column({ name: 'tarif_id', nullable: true })
  tarifId: number | undefined;

  @Column({ length: 100 })
  name: string | undefined;

  @Column({ default: 1 })
  quantity: number | undefined;

  @Column('decimal', { name: 'unit_price', precision: 10, scale: 2 })
  unitPrice: number | undefined;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discount: number | undefined;

  @Column({
    name: 'discount_type',
    type: 'enum',
    enum: DiscountType,
    default: DiscountType.NOMINAL,
  })
  discountType: DiscountType | undefined;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number | undefined;

  // Relations
  @ManyToOne(() => Billing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'billing_id' })
  billing: Billing | undefined;

  @ManyToOne(() => Tarif, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tarif_id' })
  tarif: Tarif | undefined;
}
