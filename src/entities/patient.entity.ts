import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Gender, SyncStatus, MaritalStatus } from '../enums';
import { Clinic } from './clinic.entity';

@Entity('patients')
@Index(['noRm', 'clinicId'], { unique: true })
@Index(['nik', 'clinicId'], { unique: true })
export class Patient extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'no_rm', length: 20 })
  noRm: string;

  @Column({ length: 16, nullable: true })
  nik: string;

  @Column({ name: 'nik_ibu', length: 16, nullable: true })
  nikIbu: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'birth_date', type: 'date' })
  birthDate: Date;

  @Column({ name: 'birth_order', nullable: true })
  birthOrder: number;

  @Column({
    type: 'enum',
    enum: Gender,
  })
  gender: Gender;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column('text', { nullable: true })
  address: string;

  @Column({ length: 100, nullable: true })
  city: string;

  @Column({ length: 100, nullable: true })
  province: string;

  @Column({ name: 'postal_code', length: 10, nullable: true })
  postalCode: string;

  @Column({
    name: 'marital_status',
    type: 'enum',
    enum: MaritalStatus,
    nullable: true,
  })
  maritalStatus: MaritalStatus;

  @Column({ name: 'ihs_number', length: 50, nullable: true })
  ihsNumber: string;

  @Column({ name: 'satusehat_patient_id', length: 100, nullable: true })
  satusehatPatientId: string;

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
}
