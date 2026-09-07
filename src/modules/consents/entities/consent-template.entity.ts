import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Tarif } from '../../tarif/entities/tarif.entity';

/**
 * Template informed consent per tindakan (PRD 5.16) — Owner yang mengatur
 * teks persetujuannya. Dipakai sebagai isi awal saat PatientConsent dibuat
 * untuk sebuah kunjungan/tindakan.
 */
@Entity('consent_templates')
@Unique(['clinicId', 'tarifId'])
export class ConsentTemplate extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'tarif_id' })
  tarifId: number;

  @Column({ length: 200 })
  title: string;

  @Column('text')
  content: string;

  @ManyToOne(() => Tarif, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tarif_id' })
  tarif: Tarif;
}
