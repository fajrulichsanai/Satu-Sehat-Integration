import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Barang } from './barang.entity';

export enum StokTransaksiType {
  IN = 'in',
  OUT = 'out',
  ADJUSTMENT = 'adjustment',
  EXPIRED = 'expired',
}

@Entity('stok_transaksi')
@Index(['clinicId'])
@Index(['barangId'])
export class StokTransaksi extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'barang_id' })
  barangId: number;

  @Column({ type: 'enum', enum: StokTransaksiType })
  type: StokTransaksiType;

  @Column('int')
  qty: number;

  @Column('bigint', { name: 'harga_beli', nullable: true })
  hargaBeli: number;

  @Column({ name: 'no_faktur', length: 100, nullable: true })
  noFaktur: string;

  @Column({ name: 'no_batch', length: 100, nullable: true })
  noBatch: string;

  @Column({ name: 'tanggal_expiry', type: 'date', nullable: true })
  tanggalExpiry: string;

  @Column({ length: 255, nullable: true })
  alasan: string;

  @Column({ type: 'date' })
  tanggal: string;

  @Column({ name: 'created_by_user_id', nullable: true })
  createdByUserId: number;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => Barang, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'barang_id' })
  barang: Barang;
}
