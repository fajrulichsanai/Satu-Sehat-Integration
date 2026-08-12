import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('barang')
@Index(['clinicId'])
export class Barang extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 50 })
  sku: string;

  @Column({ length: 50, nullable: true })
  kategori: string;

  @Column({ name: 'satuan_beli', length: 20 })
  satuanBeli: string;

  @Column({ name: 'satuan_pakai', length: 20 })
  satuanPakai: string;

  @Column({ name: 'konversi_qty', type: 'int', default: 1 })
  konversiQty: number;

  @Column({ name: 'supplier_name', length: 150, nullable: true })
  supplierName: string;

  @Column('bigint', { name: 'harga_beli', default: 0 })
  hargaBeli: number;

  @Column({ name: 'stok_minimum', type: 'int', default: 0 })
  stokMinimum: number;

  @Column({ name: 'stok_saat_ini', type: 'int', default: 0 })
  stokSaatIni: number;

  @Column({ name: 'track_expiry', default: false })
  trackExpiry: boolean;

  @Column({ name: 'lokasi_simpan', length: 100, nullable: true })
  lokasiSimpan: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
