import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

export const RADIOLOGY_STATUSES = [
  'ordered',
  'completed',
  'cancelled',
] as const;
export type RadiologyStatus = (typeof RADIOLOGY_STATUSES)[number];

/** Kode modalitas DICOM yang umum di klinik */
export const MODALITIES = [
  'DX',
  'CR',
  'IO',
  'PX',
  'CT',
  'MR',
  'US',
  'MG',
  'XA',
  'RF',
  'NM',
  'OT',
] as const;
export type Modality = (typeof MODALITIES)[number];

/**
 * Permintaan & hasil pemeriksaan radiologi (Playbook bab 11). Accession
 * number dipakai DICOM router untuk menautkan citra (ImagingStudy).
 */
@Entity('radiology_orders')
@Index(['encounterId'])
export class RadiologyOrder extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({
    name: 'code_system',
    type: 'varchar',
    length: 100,
    default: 'http://loinc.org',
  })
  codeSystem: string;

  @Column({ type: 'varchar', length: 255 })
  display: string;

  @Column({ name: 'name_id', type: 'varchar', length: 255 })
  nameId: string;

  @Column({ type: 'varchar', length: 4 })
  modality: Modality;

  @Index({ unique: true })
  @Column({ name: 'accession_number', type: 'varchar', length: 40 })
  accessionNumber: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ordered' })
  status: RadiologyStatus;

  /** Bacaan/hasil (Observation.valueString) */
  @Column({ name: 'result_text', type: 'text', nullable: true })
  resultText: string | null;

  /** Kesimpulan/kesan (DiagnosticReport.conclusion) */
  @Column({ type: 'text', nullable: true })
  conclusion: string | null;

  @Column({ name: 'resulted_at', type: 'datetime', nullable: true })
  resultedAt: Date | null;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
