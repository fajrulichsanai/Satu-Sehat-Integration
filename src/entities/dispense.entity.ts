import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Encounter } from './encounter.entity';
import { Prescription } from './prescription.entity';
import { Medication } from './medication.entity';

@Entity('dispenses')
@Index(['encounterId'])
@Index(['prescriptionId'])
export class Dispense extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({ name: 'prescription_id' })
  prescriptionId: number;

  @Column({ name: 'medication_id' })
  medicationId: number;

  @Column({ name: 'quantity_dispensed' })
  quantityDispensed: number;

  @Column({ name: 'dispensed_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  dispensedAt: Date;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @ManyToOne(() => Prescription, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @ManyToOne(() => Medication, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'medication_id' })
  medication: Medication;
}
