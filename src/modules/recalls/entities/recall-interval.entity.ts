import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Tarif } from '../../tarif/entities/tarif.entity';

/**
 * Interval recall default per tindakan (PRD 5.10) — Owner yang mengatur,
 * dipakai untuk otomatis menjadwalkan PatientRecall setiap kali tindakan
 * ini ditagih di sebuah billing (lihat BillingsService.create).
 */
@Entity('recall_intervals')
@Unique(['clinicId', 'tarifId'])
export class RecallInterval extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'tarif_id' })
  tarifId: number;

  @Column({ name: 'interval_days' })
  intervalDays: number;

  @ManyToOne(() => Tarif, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tarif_id' })
  tarif: Tarif;
}
