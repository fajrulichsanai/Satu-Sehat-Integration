import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { PhotoTemplateGroup } from './photo-template-group.entity';

/** Satu slot foto di dalam satu folder (photo_template_groups). */
@Entity('photo_templates')
@Index(['groupId'])
export class PhotoTemplate extends BaseEntity {
  @Column({ name: 'group_id' })
  groupId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToOne(() => PhotoTemplateGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: PhotoTemplateGroup;
}
