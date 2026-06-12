import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { SyncStatus } from '../enums';
import { Encounter } from './encounter.entity';
import { Medication } from './medication.entity';

export enum PrescriptionStatus {
  ACTIVE = 'active',
  DISPENSED = 'dispensed',
  CANCELLED = 'cancelled',
}

export enum DurationUnit {
  DAYS = 'days',
  WEEKS = 'weeks',
  MONTHS = 'months',
}

@Entity('prescriptions')
@Index(['encounterId'])
@Index(['medicationId'])
export class Prescription extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ name: 'medication_id' })
  medicationId: number;

  @Column({ name: 'dosage_instruction', length: 255 })
  dosageInstruction: string;

  @Column()
  quantity: number;

  @Column({ nullable: true })
  duration: number;

  @Column({
    name: 'duration_unit',
    type: 'enum',
    enum: DurationUnit,
    nullable: true,
  })
  durationUnit: DurationUnit;

  @Column('text', { nullable: true })
  note: string;

  @Column({
    type: 'enum',
    enum: PrescriptionStatus,
    default: PrescriptionStatus.ACTIVE,
  })
  status: PrescriptionStatus;

  @Column({ name: 'dispensed_at', nullable: true })
  dispensedAt: Date;

  @Column({ name: 'satusehat_medreq_id', length: 100, nullable: true })
  satusehatMedreqId: string;

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

  @ManyToOne(() => Medication, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'medication_id' })
  medication: Medication;
}
