import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

/** Fitur custom yang didaftarkan super admin (kunci berawalan "custom:") */
@Entity('custom_features')
export class CustomFeature extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60 })
  key: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;
}
