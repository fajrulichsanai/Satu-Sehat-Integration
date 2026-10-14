import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

/** Pengaturan tingkat platform yang diubah super admin dari panel, tanpa deploy */
@Entity('platform_settings')
@Index(['settingKey'], { unique: true })
export class PlatformSetting extends BaseEntity {
  @Column({ name: 'setting_key', type: 'varchar', length: 60 })
  settingKey: string;

  @Column({ type: 'varchar', length: 500 })
  value: string;
}
