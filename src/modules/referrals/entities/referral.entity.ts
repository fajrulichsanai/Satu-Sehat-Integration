import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';
import type { CareType } from '../referral-codes';

export interface ReferralCoding {
  code: string;
  display: string;
}

/** Kandidat RS rujukan dari rekomendasi SATUSEHAT Rujukan */
export interface ReferralCandidate {
  orgId: string;
  name: string;
  distanceKm: number | null;
  strata: string | null;
  bpjsCode: string | null;
}

/** Kuesioner (contained Questionnaire) dari respon kriteria rujukan */
export interface ReferralQuestionnaires {
  criteria: Record<string, any> | null;
  area: Record<string, any> | null;
}

/**
 * Status alur Rujukan Rawat Jalan:
 *  draft       → baru dicatat (belum ke SATUSEHAT / SATUSEHAT belum siap)
 *  criteria    → pra permintaan terkirim, menunggu jawaban kuesioner
 *  candidates  → kandidat RS sudah/sedang dicari
 *  sent        → permintaan rujukan terkirim, Nomor Rujukan Nasional terbit
 *  local       → dicatat sebagai rujukan manual (tidak lewat SATUSEHAT)
 *  cancelled   → dibatalkan sebelum terkirim
 */
export const REFERRAL_STATUSES = [
  'draft',
  'criteria',
  'candidates',
  'sent',
  'local',
  'cancelled',
] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

@Entity('referrals')
@Index(['clinicId', 'encounterId'])
@Index(['clinicId', 'patientId'])
export class Referral extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ name: 'patient_id' })
  patientId: number;

  @Column({ name: 'care_type', type: 'varchar', length: 20 })
  careType: CareType;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: ReferralStatus;

  @Column({ name: 'primary_diagnosis', type: 'json' })
  primaryDiagnosis: ReferralCoding;

  @Column({ name: 'secondary_diagnoses', type: 'json', nullable: true })
  secondaryDiagnoses: ReferralCoding[] | null;

  /** Lampiran 4 — Kelompok Layanan */
  @Column({ name: 'service_group', type: 'json' })
  serviceGroup: ReferralCoding;

  /** Poli tujuan (clinical-speciality LY…) — CarePlan.activity */
  @Column({ type: 'json' })
  specialty: ReferralCoding;

  /** Jenis nakes pelaksana rujukan (SNOMED occupation) */
  @Column({ name: 'performer_type', type: 'json', nullable: true })
  performerType: ReferralCoding | null;

  /** Alasan / ringkasan klinis rujukan */
  @Column({ type: 'text' })
  reason: string;

  /** Pesan untuk pasien (ServiceRequest.patientInstruction) */
  @Column({ name: 'patient_instruction', type: 'text', nullable: true })
  patientInstruction: string | null;

  /** Tanggal rencana kunjungan ke RS rujukan */
  @Column({ name: 'planned_date', type: 'date' })
  plannedDate: string;

  /** Nomor rujukan PCare (khusus peserta BPJS, opsional) */
  @Column({ name: 'pcare_number', type: 'varchar', length: 50, nullable: true })
  pcareNumber: string | null;

  // ── Tujuan ──
  @Column({
    name: 'target_org_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  targetOrgId: string | null;

  @Column({ name: 'target_name', type: 'varchar', length: 255, nullable: true })
  targetName: string | null;

  // ── Alur SATUSEHAT Rujukan ──
  @Column({ name: 'pre_task_id', type: 'varchar', length: 100, nullable: true })
  preTaskId: string | null;

  @Column({ type: 'json', nullable: true })
  questionnaires: ReferralQuestionnaires | null;

  /** Jawaban yang dikirim saat mencari kandidat (linkId → nilai) */
  @Column({ name: 'criteria_answers', type: 'json', nullable: true })
  criteriaAnswers: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  area: {
    provinceCode: string;
    provinceName: string;
    cityCode: string;
    cityName: string;
  } | null;

  @Column({
    name: 'candidate_task_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  candidateTaskId: string | null;

  @Column({ type: 'json', nullable: true })
  candidates: ReferralCandidate[] | null;

  @Column({
    name: 'service_request_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  serviceRequestId: string | null;

  @Column({
    name: 'care_plan_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  carePlanId: string | null;

  /** Nomor Rujukan Nasional dari SATUSEHAT */
  @Column({
    name: 'referral_number',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  referralNumber: string | null;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
