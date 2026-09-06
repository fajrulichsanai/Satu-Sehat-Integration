import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

@Entity('encounter_soap_notes')
@Index(['encounterId'], { unique: true })
export class EncounterSoapNote extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ type: 'text', nullable: true })
  subjective: string;

  @Column({ type: 'text', nullable: true })
  objective: string;

  @Column({ type: 'text', nullable: true })
  assessment: string;

  // Tindakan yang dilakukan pada kunjungan ini (bukan rencana ke depan —
  // itu ada di `plan`).
  @Column({ type: 'text', nullable: true })
  treatment: string;

  @Column({ type: 'text', nullable: true })
  plan: string;

  @Column({ type: 'mediumtext', nullable: true })
  signature: string;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
