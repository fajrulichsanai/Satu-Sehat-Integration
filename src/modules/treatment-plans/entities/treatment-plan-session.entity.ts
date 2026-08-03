import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { TreatmentSessionStatus } from '../../../enums';
import { TreatmentPlan } from './treatment-plan.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

@Entity('treatment_plan_sessions')
@Index(['treatmentPlanId'])
export class TreatmentPlanSession extends BaseEntity {
  @Column({ name: 'treatment_plan_id' })
  treatmentPlanId: number;

  @Column({ name: 'stage_number', type: 'int' })
  stageNumber: number;

  @Column({ name: 'encounter_id', nullable: true })
  encounterId: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({
    type: 'enum',
    enum: TreatmentSessionStatus,
    default: TreatmentSessionStatus.COMPLETED,
  })
  status: TreatmentSessionStatus;

  @ManyToOne(() => TreatmentPlan, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'treatment_plan_id' })
  treatmentPlan: TreatmentPlan;

  @ManyToOne(() => Encounter, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
