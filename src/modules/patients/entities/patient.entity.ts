import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Gender, SyncStatus, MaritalStatus } from '../../../enums';
import { Clinic } from './../../clinics/entities/clinic.entity';

@Entity('patients')
@Index(['noRm', 'clinicId'], { unique: true })
@Index(['nik', 'clinicId'], { unique: true })
export class Patient extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number | undefined;

  @Column({ name: 'no_rm', length: 20 })
  noRm: string | undefined;

  @Column({ length: 16, nullable: true })
  nik: string | undefined;

  @Column({ name: 'nik_ibu', length: 16, nullable: true })
  nikIbu: string | undefined;

  @Column({ length: 100 })
  name: string | undefined;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: Date | undefined;

  @Column({ name: 'birth_order', nullable: true })
  birthOrder: number | undefined;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender: Gender | undefined;

  @Column({ length: 20, nullable: true })
  phone: string | undefined;

  @Column({ length: 100, nullable: true })
  email: string | undefined;

  @Column('text', { nullable: true })
  address: string | undefined;

  @Column({ length: 100, nullable: true })
  city: string | undefined;

  @Column({ length: 100, nullable: true })
  province: string | undefined;

  @Column({ name: 'postal_code', length: 10, nullable: true })
  postalCode: string | undefined;

  @Column({
    name: 'marital_status',
    type: 'enum',
    enum: MaritalStatus,
    nullable: true,
  })
  maritalStatus: MaritalStatus | undefined;

  @Column({ name: 'ihs_number', length: 50, nullable: true })
  ihsNumber: string | undefined;

  @Column({ name: 'satusehat_patient_id', length: 100, nullable: true })
  satusehatPatientId: string | undefined;

  @Column({
    name: 'sync_status',
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.PENDING,
  })
  syncStatus: SyncStatus | undefined;

  @Column('text', { name: 'sync_error', nullable: true })
  syncError: string | undefined;

  @Column({ name: 'last_sync_at', nullable: true })
  lastSyncAt: Date | undefined;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic | undefined;
}
