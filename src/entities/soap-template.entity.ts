import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Clinic } from './clinic.entity';

@Entity('soap_templates')
@Index(['clinicId'])
@Index(['createdBy'])
export class SoapTemplate extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  subjective: string;

  @Column({ type: 'text', nullable: true })
  objective: string;

  @Column({ type: 'text', nullable: true })
  assessment: string;

  @Column({ type: 'text', nullable: true })
  plan: string;

  @Column({ name: 'is_shared', default: false })
  isShared: boolean;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
