import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

@Entity('encounter_soap_notes')
@Index(['encounterId'], { unique: true })
export class EncounterSoapNote extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ type: 'text', nullable: true })
  subjective: string;

  @Column({ type: 'text', nullable: true })
  objective: string;

  @Column({ type: 'text', nullable: true })
  assessment: string;

  // Tindakan yang dilakukan pada kunjungan ini (bukan rencana ke depan —
  // itu ada di `plan`).
  @Column({ type: 'text', nullable: true })
  treatment: string;

  @Column({ type: 'text', nullable: true })
  plan: string;

  // Rencana kontrol/kunjungan ulang berikutnya (bagian dari CPPT) — terpisah
  // dari `plan` karena ditampilkan sebagai baris sendiri di lembar CPPT.
  @Column({ name: 'control_plan', type: 'text', nullable: true })
  controlPlan: string;

  @Column({ type: 'mediumtext', nullable: true })
  signature: string;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
