import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

/** Fitur yang dinyalakan/dimatikan owner untuk satu user di kliniknya */
@Entity('user_features')
@Index(['userId', 'clinicId', 'featureKey'], { unique: true })
export class UserFeature extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'feature_key', type: 'varchar', length: 60 })
  featureKey: string;

  @Column({ type: 'boolean' })
  enabled: boolean;
}
