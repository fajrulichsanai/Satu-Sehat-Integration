import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Encounter } from './encounter.entity';

@Entity('vital_signs')
@Index(['encounterId'])
@Index(['loincCode'])
export class VitalSign extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ name: 'loinc_code', length: 20 })
  loincCode: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  @Column({ length: 20 })
  unit: string;

  @Column({ name: 'is_out_of_range', default: false })
  isOutOfRange: boolean;

  @Column({ name: 'recorded_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  recordedAt: Date;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
