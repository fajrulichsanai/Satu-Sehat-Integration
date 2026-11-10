import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('tarifs')
@Index(['clinicId'])
export class Tarif extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50 })
  kategori: string;

  @Column({ name: 'kode_icd9', length: 10, nullable: true })
  kodeIcd9: string;

  @Column('text', { nullable: true })
  deskripsi: string;

  @Column('bigint', { name: 'harga_pokok', default: 0 })
  hargaPokok: number;

  @Column('bigint', { name: 'harga_jual' })
  hargaJual: number;

  // Biaya lab per tindakan (mis. crown, gigi tiruan): dikurangkan dari dasar
  // share fee dokter dan dihitung sebagai biaya di laporan keuangan.
  @Column('bigint', { name: 'biaya_lab', default: 0 })
  biayaLab: number;

  @Column('bigint', { name: 'diskon_maksimal', default: 0 })
  diskonMaksimal: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
