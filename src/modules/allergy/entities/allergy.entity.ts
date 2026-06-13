import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

export enum AllergyLevel {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
}

@Entity('allergies')
@Index(['encounterId'])
export class Allergy extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ length: 100 })
  substansi: string;

  @Column({ type: 'text' })
  reaksi: string;

  @Column({ type: 'enum', enum: AllergyLevel })
  tingkat: AllergyLevel;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
