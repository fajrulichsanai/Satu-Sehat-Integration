import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Encounter } from './encounter.entity';

@Entity('ohis_data')
export class OhisData extends BaseEntity {
  @Column({ name: 'encounter_id', unique: true })
  encounterId: number;

  @Column({ type: 'json' })
  scores: Record<string, { debris: number; calculus: number }>;

  @Column({ name: 'di_s', type: 'decimal', precision: 4, scale: 2 })
  diS: number;

  @Column({ name: 'ci_s', type: 'decimal', precision: 4, scale: 2 })
  ciS: number;

  @Column({ name: 'ohi_s', type: 'decimal', precision: 4, scale: 2 })
  ohiS: number;

  @Column({ length: 50 })
  interpretation: string;

  @OneToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
