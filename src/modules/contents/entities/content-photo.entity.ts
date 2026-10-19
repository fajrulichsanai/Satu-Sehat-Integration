import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ClinicContent } from './clinic-content.entity';

export enum ContentPhotoSource {
  PATIENT_PHOTO = 'patient_photo',
  SUPPORTING_EXAM_IMAGE = 'supporting_exam_image',
}

/**
 * One photo of a `series`-layout content. Points at an existing photo
 * (clinical-photos' patient_photos, or supporting-exam's images) instead of
 * copying the file — picking a photo for content never duplicates it.
 */
@Entity('content_photos')
@Index(['contentId'])
export class ContentPhoto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'content_id' })
  contentId: number;

  @Column({
    name: 'source_type',
    type: 'enum',
    enum: ContentPhotoSource,
  })
  sourceType: ContentPhotoSource;

  @Column({ name: 'source_id' })
  sourceId: number;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ length: 160, nullable: true })
  caption: string | null;

  @Column({ name: 'blur_face', default: false })
  blurFace: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ClinicContent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_id' })
  content: ClinicContent;
}
