import { Entity, Column, OneToMany, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { PhotoTemplate } from './photo-template.entity';

/**
 * Satu "folder" foto klinis. `clinicId` null = bawaan sistem (mis. "Behel"),
 * dipakai semua klinik; diisi = folder buatan klinik itu sendiri.
 */
@Entity('photo_template_groups')
@Index(['clinicId'])
export class PhotoTemplateGroup extends BaseEntity {
  @Column({ name: 'clinic_id', type: 'int', nullable: true })
  clinicId: number | null;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'clinic_id' })
  clinic?: Clinic | null;

  @OneToMany(() => PhotoTemplate, (t) => t.group)
  templates: PhotoTemplate[];
}
