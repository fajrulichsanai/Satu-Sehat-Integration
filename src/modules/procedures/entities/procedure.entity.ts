import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { SyncStatus } from '../enums';
import { Encounter } from './encounter.entity';
import { Diagnosis } from './diagnosis.entity';

export enum ProcedureStatus {
  PREPARATION = 'preparation',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  NOT_DONE = 'not_done',
  STOPPED = 'stopped',
}

@Entity('procedures')
@Index(['encounterId'])
export class Procedure extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ name: 'icd9_code', length: 10 })
  icd9Code: string;

  @Column({ name: 'procedure_name', length: 255 })
  procedureName: string;

  @Column({
    type: 'enum',
    enum: ProcedureStatus,
    default: ProcedureStatus.COMPLETED,
  })
  status: ProcedureStatus;

  @Column({ name: 'performed_start' })
  performedStart: Date;

  @Column({ name: 'performed_end', nullable: true })
  performedEnd: Date;

  @Column({ name: 'reason_diagnosis_id', nullable: true })
  reasonDiagnosisId: number;

  @Column({ name: 'tooth_number', length: 5, nullable: true })
  toothNumber: string;

  @Column('text', { nullable: true })
  note: string;

  @Column({ name: 'satusehat_procedure_id', length: 100, nullable: true })
  satusehatProcedureId: string;

  @Column({
    name: 'sync_status',
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  syncStatus: SyncStatus;

  // Relations
  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @ManyToOne(() => Diagnosis, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reason_diagnosis_id' })
  reasonDiagnosis: Diagnosis;
}
