import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Patient } from '../../patients/entities/patient.entity';

/**
 * One row per tooth per patient (FDI/ISO 3950 numbering, e.g. 11-48) —
 * the odontogram is a patient-level living chart, not per-encounter, so it
 * carries findings forward across visits. `wholeCondition` covers findings
 * that apply to the whole tooth (missing, root remnant, root-canal-treated,
 * crown, impacted, implant); the five `surface*` columns cover per-surface
 * findings (caries/filling) on Mesial, Distal, Vestibular, Lingual/Palatal,
 * and Oklusal/Insisal — the five faces used in international dental
 * charting (WHO/ADA conventions, matching Indonesia's Permenkes 269/2008
 * odontogram standard, itself FDI-based).
 */
@Entity('tooth_conditions')
@Index(['patientId', 'toothNumber'], { unique: true })
export class ToothCondition extends BaseEntity {
  @Column({ name: 'patient_id' })
  patientId: number;

  @Column({ name: 'tooth_number', type: 'int' })
  toothNumber: number;

  @Column({
    name: 'whole_condition',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  wholeCondition: string;

  @Column({
    name: 'surface_mesial',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  surfaceMesial: string;

  @Column({
    name: 'surface_distal',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  surfaceDistal: string;

  @Column({
    name: 'surface_vestibular',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  surfaceVestibular: string;

  @Column({
    name: 'surface_lingual',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  surfaceLingual: string;

  @Column({
    name: 'surface_occlusal',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  surfaceOcclusal: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;
}
