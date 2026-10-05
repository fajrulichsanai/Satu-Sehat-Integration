import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

/**
 * Pengkajian resep oleh apoteker/tenaga farmasi (Playbook bab 17,
 * Questionnaire Q0007). Satu pengkajian per kunjungan, mencakup semua resep.
 *  - 1.x / 2.x / 3.1: "sesuai" | "tidak_sesuai"
 *  - 3.2–3.5: true (ada masalah) / false (tidak ada)
 */
@Entity('prescription_reviews')
@Index(['encounterId'], { unique: true })
export class PrescriptionReview extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ type: 'json' })
  answers: Record<string, 'sesuai' | 'tidak_sesuai' | boolean>;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'reviewed_at', type: 'datetime' })
  reviewedAt: Date;

  @Column({ name: 'reviewed_by', type: 'int' })
  reviewedBy: number;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
