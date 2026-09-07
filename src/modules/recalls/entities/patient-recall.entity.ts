import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Tarif } from '../../tarif/entities/tarif.entity';

export enum PatientRecallStatus {
  BELUM_DIHUBUNGI = 'belum_dihubungi',
  SUDAH_DIHUBUNGI = 'sudah_dihubungi',
  SUDAH_BOOKING_ULANG = 'sudah_booking_ulang',
}

/**
 * Satu baris = satu pasien yang perlu dihubungi kembali untuk kontrol,
 * dijadwalkan otomatis saat tindakan yang punya RecallInterval ditagih
 * (lihat BillingsService.create). Admin bisa override dueDate per pasien
 * dan menandai status kontaknya (PRD 5.10).
 */
@Entity('patient_recalls')
@Index(['clinicId', 'status', 'dueDate'])
export class PatientRecall extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'patient_id' })
  patientId: number;

  @Column({ name: 'tarif_id', type: 'int', nullable: true })
  tarifId: number | null;

  @Column({ name: 'billing_item_id', type: 'int', nullable: true })
  billingItemId: number | null;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({
    type: 'varchar',
    length: 24,
    default: PatientRecallStatus.BELUM_DIHUBUNGI,
  })
  status: PatientRecallStatus;

  @Column({ name: 'contacted_at', type: 'datetime', nullable: true })
  contactedAt: Date | null;

  @Column({ name: 'contacted_by', type: 'int', nullable: true })
  contactedBy: number | null;

  @Column({ name: 'notified_h1_at', type: 'datetime', nullable: true })
  notifiedH1At: Date | null;

  @Column('text', { nullable: true })
  notes: string | null;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Tarif, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tarif_id' })
  tarif: Tarif | null;
}
