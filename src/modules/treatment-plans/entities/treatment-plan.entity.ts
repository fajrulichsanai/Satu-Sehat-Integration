import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { TreatmentType, TreatmentPlanStatus } from '../../../enums';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Patient } from '../../patients/entities/patient.entity';

@Entity('treatment_plans')
@Index(['patientId'])
@Index(['clinicId'])
export class TreatmentPlan extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'patient_id' })
  patientId: number;

  @Column({
    name: 'treatment_type',
    type: 'enum',
    enum: TreatmentType,
    default: TreatmentType.OTHER,
  })
  treatmentType: TreatmentType;

  @Column({ length: 150, nullable: true })
  label: string;

  @Column({ name: 'total_stages', type: 'int', nullable: true })
  totalStages: number;

  @Column({ name: 'current_stage', type: 'int', default: 0 })
  currentStage: number;

  @Column({
    type: 'enum',
    enum: TreatmentPlanStatus,
    default: TreatmentPlanStatus.ACTIVE,
  })
  status: TreatmentPlanStatus;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;
}
