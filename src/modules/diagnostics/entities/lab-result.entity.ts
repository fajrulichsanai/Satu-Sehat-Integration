import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { LabOrder } from './lab-order.entity';

/** Interpretasi hasil (v3-ObservationInterpretation) */
export const LAB_INTERPRETATIONS = [
  'N',
  'L',
  'H',
  'LL',
  'HH',
  'A',
  'POS',
  'NEG',
] as const;
export type LabInterpretation = (typeof LAB_INTERPRETATIONS)[number];

/** Satu parameter hasil pemeriksaan lab (Observation kategori laboratory). */
@Entity('lab_results')
@Index(['orderId'])
export class LabResult extends BaseEntity {
  @Column({ name: 'order_id' })
  orderId: number;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({
    name: 'code_system',
    type: 'varchar',
    length: 100,
    default: 'http://loinc.org',
  })
  codeSystem: string;

  @Column({ type: 'varchar', length: 255 })
  display: string;

  @Column({ name: 'name_id', type: 'varchar', length: 255, nullable: true })
  nameId: string | null;

  /** Kuantitatif → angka + satuan */
  @Column({
    name: 'value_number',
    type: 'decimal',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  valueNumber: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  unit: string | null;

  /** Nominal/ordinal → kode jawaban (LOINC answer list) */
  @Column({ name: 'value_code', type: 'varchar', length: 30, nullable: true })
  valueCode: string | null;

  @Column({
    name: 'value_code_display',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  valueCodeDisplay: string | null;

  @Column({
    name: 'value_code_system',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  valueCodeSystem: string | null;

  /** Naratif / teks bebas */
  @Column({ name: 'value_text', type: 'text', nullable: true })
  valueText: string | null;

  @Column({
    name: 'ref_low',
    type: 'decimal',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  refLow: string | null;

  @Column({
    name: 'ref_high',
    type: 'decimal',
    precision: 14,
    scale: 4,
    nullable: true,
  })
  refHigh: string | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  interpretation: LabInterpretation | null;

  @ManyToOne(() => LabOrder, (o) => o.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: LabOrder;
}
