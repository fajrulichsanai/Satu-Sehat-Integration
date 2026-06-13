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

  @Column('decimal', { name: 'harga_pokok', precision: 10, scale: 2, default: 0 })
  hargaPokok: number;

  @Column('decimal', { name: 'harga_jual', precision: 10, scale: 2 })
  hargaJual: number;

  @Column('decimal', { name: 'diskon_maksimal', precision: 10, scale: 2, default: 0 })
  diskonMaksimal: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
