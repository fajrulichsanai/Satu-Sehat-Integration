import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

/** Kondisi saat pulang — dipetakan ke SNOMED di FhirMapper. */
export const DISCHARGE_CONDITIONS = ['stable', 'improved', 'worsened'] as const;
export type DischargeCondition = (typeof DISCHARGE_CONDITIONS)[number];
export const PROGNOSES = ['good', 'fair', 'guarded', 'bad'] as const;
export type Prognosis = (typeof PROGNOSES)[number];

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

  // ── Data terkode untuk SATUSEHAT (Playbook RME Rawat Jalan / Use Case Gigi) ──

  /** Keluhan utama terkode SNOMED CT (melengkapi teks `subjective`). */
  @Column({
    name: 'chief_complaint_code',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  chiefComplaintCode: string | null;

  /** Nama konsep SNOMED (diisi server dari data terminologi). */
  @Column({
    name: 'chief_complaint_display',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  chiefComplaintDisplay: string | null;

  /** Edukasi diberikan ke pasien (true), tidak diberikan (false), belum diisi (null). */
  @Column({ name: 'education_given', type: 'boolean', nullable: true })
  educationGiven: boolean | null;

  /** Kondisi pasien saat meninggalkan klinik. */
  @Column({
    name: 'discharge_condition',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  dischargeCondition: DischargeCondition | null;

  /** Prognosis: baik / dubia ad bonam / dubia ad malam / buruk. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  prognosis: Prognosis | null;

  @Column({ type: 'mediumtext', nullable: true })
  signature: string;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
