import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

export enum SupportingExamImageType {
  PHOTO = 'photo',
  XRAY = 'xray',
}

// Kategori foto klinis (PRD 5.6) — hanya relevan untuk imageType PHOTO,
// dipakai juga sebagai basis fitur compare before/after.
export enum SupportingExamImageCategory {
  INTRAORAL = 'intraoral',
  EXTRAORAL = 'extraoral',
  OCCLUSAL = 'occlusal',
  BEFORE = 'before',
  PROGRESS = 'progress',
  AFTER = 'after',
}

/**
 * "Pemeriksaan Penunjang" — one uploaded image per row (photo or X-ray/
 * Rontgen), many per encounter. Kept as a plain list rather than a single
 * upsert-by-encounter row (unlike PhysicalExamination) since an encounter
 * can have any number of images.
 */
@Entity('supporting_exam_images')
@Index(['encounterId'])
export class SupportingExamImage extends BaseEntity {
  @Column({ name: 'encounter_id' })
  encounterId: number;

  @Column({
    name: 'image_type',
    type: 'enum',
    enum: SupportingExamImageType,
    default: SupportingExamImageType.PHOTO,
  })
  imageType: SupportingExamImageType;

  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  category: SupportingExamImageCategory | null;

  @Column({ name: 'file_url', length: 255 })
  fileUrl: string;

  @Column({ name: 'original_name', length: 255, nullable: true })
  originalName: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => Encounter, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;
}
