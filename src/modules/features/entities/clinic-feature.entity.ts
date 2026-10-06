import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

/** Fitur yang dinyalakan/dimatikan super admin untuk satu klinik */
@Entity('clinic_features')
@Index(['clinicId', 'featureKey'], { unique: true })
export class ClinicFeature extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'feature_key', type: 'varchar', length: 60 })
  featureKey: string;

  @Column({ type: 'boolean' })
  enabled: boolean;
}
