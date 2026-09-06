import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

/**
 * "Pemeriksaan Gigi Lanjutan" — the standard periodontal/oral-hygiene
 * indices taken alongside the odontogram, one row per encounter (upsert),
 * mirroring PhysicalExamination:
 *  - OHI-S (Greene & Vermillion): Debris Index + Calculus Index, each 0-3;
 *    OHI-S = DI + CI, categorized Good (0-1.2) / Fair (1.3-3.0) / Poor (3.1-6.0).
 *  - Gingival Index (Löe & Silness), 0-3, categorized Healthy/Mild/Moderate/Severe.
 *  - Plaque Control Record (O'Leary): surfaces with plaque / surfaces examined.
 *  - Probing depth per tooth (buccal + lingual/palatal, mm), stored as JSON
 *    since it's a sparse per-tooth map rather than fixed columns.
 */
@Entity('dental_examinations')
@Index(['encounterId'], { unique: true })
export class DentalExamination extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({
    name: 'ohis_debris',
    type: 'decimal',
    precision: 3,
    scale: 1,
    nullable: true,
  })
  ohisDebris: number;

  @Column({
    name: 'ohis_calculus',
    type: 'decimal',
    precision: 3,
    scale: 1,
    nullable: true,
  })
  ohisCalculus: number;

  @Column({
    name: 'gingival_index',
    type: 'decimal',
    precision: 3,
    scale: 1,
    nullable: true,
  })
  gingivalIndex: number;

  @Column({ name: 'plaque_surfaces_with_plaque', type: 'int', nullable: true })
  plaqueSurfacesWithPlaque: number;

  @Column({ name: 'plaque_surfaces_examined', type: 'int', nullable: true })
  plaqueSurfacesExamined: number;

  @Column({ name: 'probing_depths', type: 'json', nullable: true })
  probingDepths: { toothNumber: number; buccal?: number; lingual?: number }[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
