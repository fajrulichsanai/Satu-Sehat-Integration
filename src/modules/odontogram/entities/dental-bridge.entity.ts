import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Patient } from '../../patients/entities/patient.entity';

/**
 * A fixed prosthesis (gigi tiruan cekat) spanning a range of teeth, e.g.
 * bridge from tooth 11 to 13 with 12 as the pontic. Kept separate from
 * ToothCondition since it describes a relationship between teeth, not a
 * single tooth's own state.
 */
@Entity('dental_bridges')
@Index(['patientId'])
export class DentalBridge extends BaseEntity {
  @Column({ name: 'patient_id' })
  patientId: number;

  @Column({ name: 'from_tooth', type: 'int' })
  fromTooth: number;

  @Column({ name: 'to_tooth', type: 'int' })
  toTooth: number;

  @Column({ length: 100, default: 'Gigi Tiruan Cekat' })
  label: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;
}
