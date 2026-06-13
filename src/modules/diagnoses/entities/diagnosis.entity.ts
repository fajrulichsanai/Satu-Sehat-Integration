import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { SyncStatus } from '../../../enums';
import { Encounter } from './../..encounters/entities/encounter.entity';

export enum ClinicalStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  RESOLVED = 'resolved',
  RECURRENCE = 'recurrence',
  RELAPSE = 'relapse',
  REMISSION = 'remission',
}

export enum DiagnosisCategory {
  ENCOUNTER_DIAGNOSIS = 'encounter-diagnosis',
  PROBLEM_LIST_ITEM = 'problem-list-item',
}

@Entity('diagnoses')
@Index(['encounterId'])
export class Diagnosis extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number | undefined;

  @Column({ name: 'icd10_code', length: 10 })
  icd10Code: string | undefined;

  @Column({ name: 'icd10_display', length: 255 })
  icd10Display: string | undefined;

  @Column({
    name: 'clinical_status',
    type: 'enum',
    enum: ClinicalStatus,
    default: ClinicalStatus.ACTIVE,
  })
  clinicalStatus: ClinicalStatus | undefined;

  @Column({
    type: 'enum',
    enum: DiagnosisCategory,
    default: DiagnosisCategory.ENCOUNTER_DIAGNOSIS,
  })
  category: DiagnosisCategory | undefined;

  @Column({ name: 'body_site_code', length: 20, nullable: true })
  bodySiteCode: string | undefined;

  @Column({ name: 'body_site_display', length: 255, nullable: true })
  bodySiteDisplay: string | undefined;

  @Column({ name: 'onset_date', type: 'date', nullable: true })
  onsetDate: Date | undefined;

  @Column('text', { nullable: true })
  note: string | undefined;

  @Column({ name: 'is_primary', default: false })
  isPrimary: boolean | undefined;

  @Column({ name: 'satusehat_condition_id', length: 100, nullable: true })
  satusehatConditionId: string | undefined;

  @Column({
    name: 'sync_status',
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  syncStatus: SyncStatus | undefined;

  // Relations
  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
