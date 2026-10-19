import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { PhotoTemplate } from './photo-template.entity';

/**
 * Satu foto klinis pasien, terikat ke satu kontrol (encounter), opsional
 * terikat ke satu slot folder (template). Consent pakai-untuk-konten dicatat
 * di `patients.photo_consent_marketing` (per pasien, bukan per foto).
 */
@Entity('patient_photos')
@Index(['patientId'])
@Index(['encounterId'])
export class PatientPhoto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'patient_id' })
  patientId: number;

  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ name: 'template_id', nullable: true })
  templateId: number | null;

  @Column({ name: 'file_url', length: 500 })
  fileUrl: string;

  @Column({ name: 'original_name', length: 255, nullable: true })
  originalName: string | null;

  @Column({ name: 'taken_at' })
  takenAt: Date;

  @Column({ name: 'taken_by', nullable: true })
  takenBy: number | null;

  @Column({ name: 'original_size_bytes', nullable: true })
  originalSizeBytes: number | null;

  @Column({ name: 'compressed_size_bytes', nullable: true })
  compressedSizeBytes: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @ManyToOne(() => PhotoTemplate, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'template_id' })
  template?: PhotoTemplate | null;
}
