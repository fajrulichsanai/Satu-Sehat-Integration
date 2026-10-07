import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

/**
 * Observasi tambahan dalam satu kunjungan (FHIR Observation) dari katalog
 * tetap (clinical-codes.ts), mis. IMT, lingkar perut, GCS, status merokok,
 * gula darah glukometer. Tanda vital utama tetap di Pemeriksaan Fisik.
 */
@Entity('clinical_observations')
@Index(['clinicId', 'patientId'])
@Index(['encounterId'])
export class ClinicalObservation extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'patient_id' })
  patientId: number;

  @Column({ name: 'encounter_id' })
  encounterId: number;

  /** Kunci katalog, mis. "bmi", "glucose-poct" */
  @Column({ name: 'observation_key', type: 'varchar', length: 40 })
  observationKey: string;

  @Column({
    name: 'value_number',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      to: (v?: number | null) => v,
      from: (v?: string | null) =>
        v === null || v === undefined ? null : Number(v),
    },
  })
  valueNumber: number | null;

  /** Kode SNOMED jawaban (observasi berjenis pilihan) */
  @Column({ name: 'value_code', type: 'varchar', length: 30, nullable: true })
  valueCode: string | null;

  @Column({ name: 'effective_at', type: 'datetime' })
  effectiveAt: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  /** final | entered-in-error (dihapus setelah terkirim) */
  @Column({ type: 'varchar', length: 20, default: 'final' })
  status: string;

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
