import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Patient } from '../../patients/entities/patient.entity';

/**
 * One row per tooth per patient (FDI/ISO 3950 numbering, 11-48 permanent
 * plus 51-85 deciduous) — the odontogram is a patient-level living chart,
 * not per-encounter, so it carries findings forward across visits.
 * `teksAtas`/`teksBawah` are the annotation codes printed above/below the
 * tooth on the chart (SOU/ATT/PRE/UNE/ANO/NON and MISSING/CFR/RRX
 * respectively); `rct` (root canal treatment) is independent of those
 * since a tooth can carry RCT alongside another annotation. The five
 * `surface*` columns cover per-surface findings (karies/komposit/gic) on
 * Mesial, Distal, Vestibular, Lingual/Palatal, and Oklusal/Insisal — the
 * five faces used in international dental charting (WHO/ADA conventions,
 * matching Indonesia's Permenkes 269/2008 odontogram standard and the
 * SATUSEHAT terminology this data is mapped to for FHIR sync).
 */
@Entity('tooth_conditions')
@Index(['patientId', 'toothNumber'], { unique: true })
export class ToothCondition extends BaseEntity {
  @Column({ name: 'patient_id' })
  patientId: number;

  @Column({ name: 'tooth_number', type: 'int' })
  toothNumber: number;

  @Column({
    name: 'teks_atas',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  teksAtas: string;

  @Column({
    name: 'teks_bawah',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  teksBawah: string;

  @Column({ type: 'boolean', default: false })
  rct: boolean;

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
