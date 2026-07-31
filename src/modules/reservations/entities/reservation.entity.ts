import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import {
  ReservationStatus,
  ReservationSource,
  ServiceType,
} from '../../../enums';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Practitioner } from '../../practitioners/entities/practitioner.entity';

@Entity('reservations')
@Index(['clinicId', 'reservationDate', 'status'])
@Index(['practitionerId', 'reservationDate'])
export class Reservation extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'patient_id', nullable: true })
  patientId: number;

  @Column({ name: 'patient_name', length: 100 })
  patientName: string;

  @Column({ name: 'patient_phone', length: 20 })
  patientPhone: string;

  @Column({ name: 'patient_nik', length: 20, nullable: true })
  patientNik: string;

  @Column({ name: 'practitioner_id', nullable: true })
  practitionerId: number;

  @Column({
    name: 'service_type',
    type: 'enum',
    enum: ServiceType,
    nullable: true,
  })
  serviceType: ServiceType;

  @Column({ name: 'reservation_date', type: 'date' })
  reservationDate: string;

  @Column({ name: 'jam_slot', type: 'time', nullable: true })
  jamSlot: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.PENDING,
  })
  status: ReservationStatus;

  @Column({
    type: 'enum',
    enum: ReservationSource,
    default: ReservationSource.DASHBOARD,
  })
  source: ReservationSource;

  @Column({ length: 8, unique: true })
  token: string;

  @Column({ name: 'cancelled_reason', type: 'text', nullable: true })
  cancelledReason: string;

  @Column({ name: 'confirmed_at', nullable: true })
  confirmedAt: Date;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => Patient, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Practitioner, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'practitioner_id' })
  practitioner: Practitioner;
}
