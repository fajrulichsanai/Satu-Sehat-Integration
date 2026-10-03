import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { Tarif } from '../../tarif/entities/tarif.entity';
import { ConsentTemplate } from './consent-template.entity';

export enum PatientConsentStatus {
  DRAFT = 'draft',
  PARTIAL = 'partial',
  COMPLETED = 'completed',
}

export enum ConsentSignerRelation {
  SELF = 'self',
  PARENT = 'parent',
  GUARDIAN = 'guardian',
}

/**
 * Satu formulir informed consent untuk satu pasien + tindakan (PRD 5.16).
 * Isi (title/content) di-snapshot dari ConsentTemplate saat dibuat supaya
 * perubahan template selanjutnya tidak mengubah consent yang sudah ada.
 * Butuh tanda tangan pasien DAN dokter untuk berstatus completed. Tidak ada
 * pengiriman otomatis ke pasien — hanya diunduh (PDF) manual saat dibutuhkan.
 */
@Entity('patient_consents')
@Index(['clinicId', 'patientId'])
export class PatientConsent extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'patient_id' })
  patientId: number;

  @Column({ name: 'encounter_id', type: 'int', nullable: true })
  encounterId: number | null;

  @Column({ name: 'tarif_id', type: 'int', nullable: true })
  tarifId: number | null;

  @Column({ name: 'template_id', type: 'int', nullable: true })
  templateId: number | null;

  @Column({ length: 200 })
  title: string;

  @Column('text')
  content: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: PatientConsentStatus.DRAFT,
  })
  status: PatientConsentStatus;

  @Column({ name: 'patient_signature', type: 'mediumtext', nullable: true })
  patientSignature: string | null;

  @Column({
    name: 'patient_signer_name',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  patientSignerName: string | null;

  @Column({
    name: 'signer_relation',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  signerRelation: ConsentSignerRelation | null;

  @Column({ name: 'signer_address', type: 'text', nullable: true })
  signerAddress: string | null;

  @Column({ name: 'signer_phone', type: 'varchar', length: 20, nullable: true })
  signerPhone: string | null;

  @Column({ name: 'patient_signed_at', type: 'datetime', nullable: true })
  patientSignedAt: Date | null;

  @Column({ name: 'doctor_signature', type: 'mediumtext', nullable: true })
  doctorSignature: string | null;

  @Column({ name: 'doctor_signed_by', type: 'int', nullable: true })
  doctorSignedBy: number | null;

  @Column({ name: 'doctor_signed_at', type: 'datetime', nullable: true })
  doctorSignedAt: Date | null;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Encounter, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter | null;

  @ManyToOne(() => Tarif, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tarif_id' })
  tarif: Tarif | null;

  @ManyToOne(() => ConsentTemplate, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'template_id' })
  template: ConsentTemplate | null;
}
