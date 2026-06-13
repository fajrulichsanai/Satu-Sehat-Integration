import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

@Entity('odontogram_data')
export class OdontogramData extends BaseEntity {
  @Column({ name: 'encounter_id', unique: true })
  encounterId: number;

  @Column({ name: 'teeth_data', type: 'json' })
  teethData: Record<string, any>;

  @Column({ name: 'dmft_decayed', default: 0 })
  dmftDecayed: number;

  @Column({ name: 'dmft_missing', default: 0 })
  dmftMissing: number;

  @Column({ name: 'dmft_filled', default: 0 })
  dmftFilled: number;

  @Column({ name: 'dmft_total', default: 0 })
  dmftTotal: number;

  @Column({ name: 'additional_findings', type: 'json', nullable: true })
  additionalFindings: Record<string, any>;

  @OneToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
