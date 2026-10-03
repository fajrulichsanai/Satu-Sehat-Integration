import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Tarif } from '../../tarif/entities/tarif.entity';
import { Barang } from './barang.entity';

@Entity('tindakan_bom')
@Index(['clinicId'])
@Index(['tarifId'])
@Unique(['tarifId', 'barangId'])
export class TindakanBom extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'tarif_id' })
  tarifId: number;

  @Column({ name: 'barang_id' })
  barangId: number;

  @Column('decimal', { name: 'qty_pakai', precision: 10, scale: 3 })
  qtyPakai: number;

  @Column({ default: true })
  wajib: boolean;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => Tarif, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tarif_id' })
  tarif: Tarif;

  @ManyToOne(() => Barang, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'barang_id' })
  barang: Barang;
}
