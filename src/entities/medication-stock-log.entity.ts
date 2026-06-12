import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Medication } from './medication.entity';

export enum StockLogType {
  IN = 'in',
  OUT = 'out',
  ADJUSTMENT = 'adjustment',
}

@Entity('medication_stock_logs')
@Index(['medicationId'])
export class MedicationStockLog extends BaseEntity {
  @Column({ name: 'medication_id' })
  medicationId: number;

  @Column({ type: 'enum', enum: StockLogType })
  type: StockLogType;

  @Column()
  quantity: number;

  @Column({ name: 'previous_quantity' })
  previousQuantity: number;

  @Column({ name: 'new_quantity' })
  newQuantity: number;

  @Column({ length: 255 })
  reason: string;

  @Column({ name: 'batch_no', length: 50, nullable: true })
  batchNo: string;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate: Date;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: number;

  @Column({ name: 'reference_type', length: 50, nullable: true })
  referenceType: string;

  @ManyToOne(() => Medication, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'medication_id' })
  medication: Medication;
}
