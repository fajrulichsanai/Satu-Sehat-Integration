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
  encounterId: number | undefined;

  @Column({ length: 100 })
  substansi: string | undefined;

  @Column({ type: 'text' })
  reaksi: string | undefined;

  @Column({ type: 'enum', enum: AllergyLevel })
  tingkat: AllergyLevel | undefined;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter | undefined;
}
