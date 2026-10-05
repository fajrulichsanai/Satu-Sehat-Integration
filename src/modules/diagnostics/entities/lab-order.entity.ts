import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { LabResult } from './lab-result.entity';

export const LAB_ORDER_STATUSES = [
  'ordered',
  'collected',
  'completed',
  'cancelled',
] as const;
export type LabOrderStatus = (typeof LAB_ORDER_STATUSES)[number];

/** Status puasa pasien sebelum pengambilan spesimen. */
export const FASTING_STATUSES = [
  'fasting',
  'not_fasting',
  'not_required',
] as const;
export type FastingStatus = (typeof FASTING_STATUSES)[number];

/**
 * Permintaan pemeriksaan laboratorium (satu kode LOINC per permintaan,
 * sesuai Playbook RME Rawat Jalan bab 10): permintaan → spesimen → hasil
 * (LabResult) → laporan (kesimpulan).
 */
@Entity('lab_orders')
@Index(['encounterId'])
export class LabOrder extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  /** Kode LOINC / Pemeriksaan Penunjang Nasional dari katalog resmi */
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

  /** Nama pemeriksaan (Bahasa Indonesia) */
  @Column({ name: 'name_id', type: 'varchar', length: 255 })
  nameId: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string | null;

  /** Jenis spesimen (mis. Darah, Serum, Urine) */
  @Column({
    name: 'specimen_type',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  specimenType: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  fasting: FastingStatus | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 20, default: 'ordered' })
  status: LabOrderStatus;

  @Column({ name: 'specimen_collected_at', type: 'datetime', nullable: true })
  specimenCollectedAt: Date | null;

  @Column({ name: 'resulted_at', type: 'datetime', nullable: true })
  resultedAt: Date | null;

  /** Kesimpulan/interpretasi laporan lab (DiagnosticReport.conclusion) */
  @Column({ type: 'text', nullable: true })
  conclusion: string | null;

  @OneToMany(() => LabResult, (r) => r.order, { cascade: true })
  results: LabResult[];

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
