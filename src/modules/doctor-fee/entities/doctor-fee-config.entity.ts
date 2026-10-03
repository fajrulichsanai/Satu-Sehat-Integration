import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Tarif } from '../../tarif/entities/tarif.entity';

export enum FeeType {
  FIXED = 'fixed',
  PERCENTAGE = 'percentage',
}

@Entity('doctor_fee_configs')
@Index(['clinicId', 'tarifId'], { unique: true })
export class DoctorFeeConfig extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'tarif_id' })
  tarifId: number;

  @Column({
    name: 'fee_type',
    type: 'enum',
    enum: FeeType,
    default: FeeType.PERCENTAGE,
  })
  feeType: FeeType;

  @Column('decimal', { name: 'fee_value', precision: 10, scale: 2, default: 0 })
  feeValue: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => Tarif, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tarif_id' })
  tarif: Tarif;
}
