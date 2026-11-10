import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

/** Tanda tangan dokter pada lembar resep satu kunjungan. */
@Entity('prescription_signatures')
export class PrescriptionSignature extends BaseEntity {
  @Column({ name: 'encounter_id', unique: true })
  encounterId: number;

  /** data:image/png;base64,… */
  @Column({ type: 'mediumtext' })
  signature: string;

  @Column({ name: 'signed_at', type: 'datetime' })
  signedAt: Date;

  @OneToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
