import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { QueueStatus } from '../../../enums';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Practitioner } from '../../practitioners/entities/practitioner.entity';

@Entity('queues')
@Index(['clinicId', 'tanggal', 'nomorAntrian'], { unique: true })
@Index(['clinicId', 'tanggal', 'status'])
@Index(['practitionerId', 'tanggal'])
export class Queue extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'patient_id', nullable: true })
  patientId: number;

  @Column({ name: 'practitioner_id' })
  practitionerId: number;

  @Column({ name: 'nomor_antrian' })
  nomorAntrian: number;

  @Column({ type: 'date' })
  tanggal: Date;

  @Column({ name: 'jam_slot', type: 'time' })
  jamSlot: string;

  @Column({ name: 'patient_name', length: 100 })
  patientName: string;

  @Column({ length: 20 })
  phone: string;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint: string;

  @Column({ name: 'is_first_visit', default: false })
  isFirstVisit: boolean;

  @Column({ name: 'is_online_booking', default: false })
  isOnlineBooking: boolean;

  @Column({ length: 8, unique: true })
  token: string;

  @Column({
    type: 'enum',
    enum: QueueStatus,
    default: QueueStatus.WAITING,
  })
  status: QueueStatus;

  @Column({ name: 'cancelled_reason', type: 'text', nullable: true })
  cancelledReason: string;

  @Column({ name: 'called_at', nullable: true })
  calledAt: Date;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => Patient, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Practitioner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'practitioner_id' })
  practitioner: Practitioner;
}
