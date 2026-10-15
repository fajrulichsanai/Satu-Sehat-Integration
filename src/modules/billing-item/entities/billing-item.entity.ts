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
  billingId: number;

  @Column({ name: 'tarif_id', nullable: true })
  tarifId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ default: 1 })
  quantity: number;

  @Column('decimal', { name: 'unit_price', precision: 10, scale: 2 })
  unitPrice: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({
    name: 'discount_type',
    type: 'enum',
    enum: DiscountType,
    default: DiscountType.NOMINAL,
  })
  discountType: DiscountType;

  @Column('decimal', { precision: 10, scale: 2 })
  subtotal: number;

  // Salinan modal (HPP) dan biaya lab per unit saat transaksi dibuat, agar
  // laporan lama tidak berubah ketika tarif diubah kemudian.
  @Column('decimal', {
    name: 'harga_pokok',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  hargaPokok: number | null;

  @Column('decimal', {
    name: 'biaya_lab',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  biayaLab: number | null;

  // Relations
  @ManyToOne(() => Billing, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'billing_id' })
  billing: Billing;

  @ManyToOne(() => Tarif, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tarif_id' })
  tarif: Tarif;
}
