import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { SyncStatus, EncounterStatus, ServiceType } from '../enums';
import { Clinic } from './clinic.entity';
import { Patient } from './patient.entity';
import { Practitioner } from './practitioner.entity';
import { Location } from './location.entity';
import { Queue } from './queue.entity';

@Entity('encounters')
@Index(['practitionerId', 'arrivedTime'])
export class Encounter extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'patient_id' })
  patientId: number;

  @Column({ name: 'practitioner_id' })
  practitionerId: number;

  @Column({ name: 'location_id' })
  locationId: number;

  @Column({ name: 'queue_id', nullable: true })
  queueId: number;

  @Column({
    name: 'service_type',
    type: 'enum',
    enum: ServiceType,
    default: ServiceType.OUTPATIENT,
  })
  serviceType: ServiceType;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint: string;

  @Column({
    type: 'enum',
    enum: EncounterStatus,
    default: EncounterStatus.ARRIVED,
  })
  status: EncounterStatus;

  @Column({ name: 'cancelled_reason', type: 'text', nullable: true })
  cancelledReason: string;

  @Column({ name: 'arrived_time' })
  arrivedTime: Date;

  @Column({ name: 'in_progress_time', nullable: true })
  inProgressTime: Date;

  @Column({ name: 'finished_time', nullable: true })
  finishedTime: Date;

  @Column({ name: 'satusehat_encounter_id', length: 100, nullable: true })
  satusehatEncounterId: string;

  @Column({
    name: 'sync_status',
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  syncStatus: SyncStatus;

  @Column('text', { name: 'sync_error', nullable: true })
  syncError: string;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => Patient, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Practitioner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'practitioner_id' })
  practitioner: Practitioner;

  @ManyToOne(() => Location, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'location_id' })
  location: Location;

  @ManyToOne(() => Queue, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'queue_id' })
  queue: Queue;
}
