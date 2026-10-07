import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

export type ConditionCodeSystem = 'icd10' | 'snomed';

/**
 * Daftar masalah pasien (FHIR Condition, kategori problem-list-item):
 * penyakit kronis / kondisi yang dipantau lintas kunjungan, mis. hipertensi,
 * diabetes. Berbeda dari diagnosis kunjungan (Catatan SOAP).
 *
 * Dicatat dan diubah selalu di dalam kunjungan, karena Condition SATUSEHAT
 * merujuk ke Encounter. `verificationStatus = entered-in-error` berarti
 * dihapus setelah terkirim (disembunyikan dari daftar).
 */
@Entity('patient_conditions')
@Index(['clinicId', 'patientId'])
@Index(['lastEncounterId'])
export class PatientCondition extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'patient_id' })
  patientId: number;

  /** Kunjungan tempat kondisi pertama kali dicatat */
  @Column({ name: 'encounter_id' })
  encounterId: number;

  /** Kunjungan terakhir yang mengubah kondisi (dikirim ulang lewat kunjungan ini) */
  @Column({ name: 'last_encounter_id' })
  lastEncounterId: number;

  @Column({ name: 'code_system', type: 'varchar', length: 10 })
  codeSystem: ConditionCodeSystem;

  @Column({ type: 'varchar', length: 30 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  display: string;

  @Column({ name: 'name_id', type: 'varchar', length: 255, nullable: true })
  nameId: string | null;

  @Column({ name: 'clinical_status', type: 'varchar', length: 20 })
  clinicalStatus: string;

  @Column({ name: 'verification_status', type: 'varchar', length: 20 })
  verificationStatus: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  severity: string | null;

  @Column({ name: 'onset_date', type: 'date', nullable: true })
  onsetDate: string | null;

  @Column({ name: 'abatement_date', type: 'date', nullable: true })
  abatementDate: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @Column({
    name: 'sync_status',
    type: 'varchar',
    length: 10,
    default: 'pending',
  })
  syncStatus: 'pending' | 'synced' | 'failed';

  @Column({ name: 'sync_error', type: 'varchar', length: 500, nullable: true })
  syncError: string | null;

  @Column({
    name: 'satusehat_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  satusehatId: string | null;

  @Column({ name: 'last_sync_at', type: 'datetime', nullable: true })
  lastSyncAt: Date | null;
}
