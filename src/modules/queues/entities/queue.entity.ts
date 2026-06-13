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
  clinicId: number | undefined;

  @Column({ name: 'patient_id', nullable: true })
  patientId: number | undefined;

  @Column({ name: 'practitioner_id' })
  practitionerId: number | undefined;

  @Column({ name: 'nomor_antrian' })
  nomorAntrian: number | undefined;

  @Column({ type: 'date' })
  tanggal: Date | undefined;

  @Column({ name: 'jam_slot', type: 'time' })
  jamSlot: string | undefined;

  @Column({ name: 'patient_name', length: 100 })
  patientName: string | undefined;

  @Column({ length: 20 })
  phone: string | undefined;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint: string | undefined;

  @Column({ name: 'is_first_visit', default: false })
  isFirstVisit: boolean | undefined;

  @Column({ name: 'is_online_booking', default: false })
  isOnlineBooking: boolean | undefined;

  @Column({ length: 8, unique: true })
  token: string | undefined;

  @Column({
    type: 'enum',
    enum: QueueStatus,
    default: QueueStatus.WAITING,
  })
  status: QueueStatus | undefined;

  @Column({ name: 'cancelled_reason', type: 'text', nullable: true })
  cancelledReason: string | undefined;

  @Column({ name: 'called_at', nullable: true })
  calledAt: Date | undefined;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic | undefined;

  @ManyToOne(() => Patient, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient | undefined;

  @ManyToOne(() => Practitioner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'practitioner_id' })
  practitioner: Practitioner | undefined;
}
