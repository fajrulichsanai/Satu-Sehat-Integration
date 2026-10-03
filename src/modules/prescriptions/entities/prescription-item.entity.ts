import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

/**
 * One prescribed drug line item for an encounter's SOAP Treatment section.
 * Plain free-text fields (not linked to Gudang stock) — this documents
 * what was prescribed, it doesn't move inventory.
 */
@Entity('prescription_items')
@Index(['encounterId'])
export class PrescriptionItem extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ name: 'drug_name', type: 'varchar', length: 255 })
  drugName: string;

  /** Kode KFA (Kamus Farmasi & Alkes) — wajib agar resep bisa dikirim ke SATUSEHAT */
  @Column({ name: 'kfa_code', type: 'varchar', length: 20, nullable: true })
  kfaCode: string | null;

  /** Nama produk sesuai KFA saat dipilih */
  @Column({ name: 'kfa_name', type: 'varchar', length: 255, nullable: true })
  kfaName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  dosage: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  frequency: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  duration: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  quantity: string;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
