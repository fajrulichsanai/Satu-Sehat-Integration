import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

@Entity('medication_history')
@Index(['encounterId'])
export class MedicationHistory extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ name: 'nama_obat', length: 100 })
  namaObat: string;

  @Column({ length: 50 })
  dosis: string;

  @Column({ length: 50 })
  frekuensi: string;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
