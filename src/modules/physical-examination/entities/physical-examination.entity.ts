import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

/**
 * Head-to-toe physical examination ("status present") for one encounter —
 * the standard structure taught/used in Indonesian clinical documentation:
 * general condition, vital signs, general status per organ, then thorax/
 * abdomen by inspection-palpation-percussion-auscultation. One row per
 * encounter (upsert), mirroring EncounterSoapNote.
 */
@Entity('physical_examinations')
@Index(['encounterId'], { unique: true })
export class PhysicalExamination extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  // Keadaan umum & kesadaran
  @Column({
    name: 'general_condition',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  generalCondition: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  consciousness: string;

  @Column({
    name: 'nutritional_status',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  nutritionalStatus: string;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  height: number;

  @Column({ type: 'decimal', precision: 5, scale: 1, nullable: true })
  weight: number;

  // Skala nyeri
  @Column({ name: 'pain_scale', type: 'int', nullable: true })
  painScale: number;

  @Column({ name: 'pain_points', type: 'json', nullable: true })
  painPoints: { x: number; y: number }[];

  // Tanda vital
  @Column({ name: 'blood_pressure_systolic', type: 'int', nullable: true })
  bloodPressureSystolic: number;

  @Column({ name: 'blood_pressure_diastolic', type: 'int', nullable: true })
  bloodPressureDiastolic: number;

  @Column({ name: 'pulse_rate', type: 'int', nullable: true })
  pulseRate: number;

  @Column({ name: 'respiratory_rate', type: 'int', nullable: true })
  respiratoryRate: number;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  temperature: number;

  @Column({ name: 'oxygen_saturation', type: 'int', nullable: true })
  oxygenSaturation: number;

  // Pemeriksaan umum
  @Column({ type: 'text', nullable: true })
  cyanosis: string;

  @Column({ type: 'text', nullable: true })
  edema: string;

  @Column({ type: 'text', nullable: true })
  anemia: string;

  @Column({ type: 'text', nullable: true })
  jaundice: string;

  // Status generalisata
  @Column({ type: 'text', nullable: true })
  skin: string;

  @Column({ name: 'lymph_nodes', type: 'text', nullable: true })
  lymphNodes: string;

  @Column({ type: 'text', nullable: true })
  head: string;

  @Column({ type: 'text', nullable: true })
  hair: string;

  @Column({ type: 'text', nullable: true })
  eyes: string;

  @Column({ type: 'text', nullable: true })
  ears: string;

  @Column({ type: 'text', nullable: true })
  nose: string;

  @Column({ type: 'text', nullable: true })
  mouth: string;

  @Column({ type: 'text', nullable: true })
  neck: string;

  // Thorax - paru
  @Column({ name: 'lung_inspection', type: 'text', nullable: true })
  lungInspection: string;

  @Column({ name: 'lung_palpation', type: 'text', nullable: true })
  lungPalpation: string;

  @Column({ name: 'lung_percussion', type: 'text', nullable: true })
  lungPercussion: string;

  @Column({ name: 'lung_auscultation', type: 'text', nullable: true })
  lungAuscultation: string;

  // Thorax - jantung
  @Column({ name: 'heart_inspection', type: 'text', nullable: true })
  heartInspection: string;

  @Column({ name: 'heart_palpation', type: 'text', nullable: true })
  heartPalpation: string;

  @Column({ name: 'heart_percussion', type: 'text', nullable: true })
  heartPercussion: string;

  @Column({ name: 'heart_auscultation', type: 'text', nullable: true })
  heartAuscultation: string;

  // Abdomen
  @Column({ name: 'abdomen_inspection', type: 'text', nullable: true })
  abdomenInspection: string;

  @Column({ name: 'abdomen_palpation', type: 'text', nullable: true })
  abdomenPalpation: string;

  @Column({ name: 'abdomen_percussion', type: 'text', nullable: true })
  abdomenPercussion: string;

  @Column({ name: 'abdomen_auscultation', type: 'text', nullable: true })
  abdomenAuscultation: string;

  // Lainnya
  @Column({ type: 'text', nullable: true })
  extremities: string;

  @Column({ type: 'text', nullable: true })
  genitalia: string;

  @Column({ type: 'text', nullable: true })
  rectal: string;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
