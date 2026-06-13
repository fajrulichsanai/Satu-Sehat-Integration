import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('soap_templates')
@Index(['clinicId'])
@Index(['createdBy'])
export class SoapTemplate extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number | undefined;

  @Column({ length: 100 })
  name: string | undefined;

  @Column({ type: 'text', nullable: true })
  subjective: string | undefined;

  @Column({ type: 'text', nullable: true })
  objective: string | undefined;

  @Column({ type: 'text', nullable: true })
  assessment: string | undefined;

  @Column({ type: 'text', nullable: true })
  plan: string | undefined;

  @Column({ name: 'is_shared', default: false })
  isShared: boolean | undefined;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic | undefined;
}
