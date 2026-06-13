import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Clinic } from './clinic.entity';

@Entity('medications')
@Index(['clinicId'])
@Index(['name'])
export class Medication extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'generic_name', length: 100, nullable: true })
  genericName: string;

  @Column({ length: 50, nullable: true })
  strength: string;

  @Column({ name: 'strength_unit', length: 20, nullable: true })
  strengthUnit: string;

  @Column({ name: 'dosage_form', length: 50 })
  dosageForm: string;

  @Column({ default: 0 })
  quantity: number;

  @Column({ name: 'min_stock', default: 0 })
  minStock: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ length: 100, nullable: true })
  supplier: string;

  @Column({ name: 'expiration_date', type: 'date', nullable: true })
  expirationDate: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
