import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

/** A coded diagnosis in the assessment (ICD-10 or SNOMED CT). */
export interface SoapDiagnosis {
  system: 'icd10' | 'snomed';
  code: string;
  /** Canonical name from the code system (set by the server). */
  display: string;
  /** Indonesian name, when the code has one (set by the server). */
  nameId?: string | null;
  /** Diagnosis utama; at most one per note. */
  primary: boolean;
  note?: string | null;
}

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

  // Diagnosis terkode (ICD-10 / SNOMED CT) — melengkapi teks assessment.
  @Column({ type: 'json', nullable: true })
  diagnoses: SoapDiagnosis[] | null;

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
