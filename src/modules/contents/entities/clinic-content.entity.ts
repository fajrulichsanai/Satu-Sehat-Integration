import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';

export enum ContentStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export enum ContentLayout {
  /** Before on top, after below. */
  STACK = 'stack',
  /** Before on the left, after on the right. */
  SPLIT = 'split',
}

export enum ContentBackground {
  LIGHT = 'light',
  NAVY = 'navy',
}

/** Position of one photo inside its frame on the story. */
export interface ContentPhotoFrame {
  zoom: number;
  ox: number;
  oy: number;
  /** Rotation in degrees, clockwise. */
  rot?: number;
  /** Mirrored horizontally (intraoral photos taken with a mirror). */
  flip?: boolean;
}

/** Everything on the story that isn't a column of its own. */
export interface ContentSettings {
  before?: ContentPhotoFrame;
  after?: ContentPhotoFrame;
  /** Header lines; default to the clinic's name and city. */
  brandName?: string;
  brandSub?: string;
  /** Top-right label, e.g. "HASIL PERAWATAN". */
  badge?: string;
  /** Footer: a short call to action, a contact line, and a social handle. */
  contactTitle?: string;
  contactLine?: string;
  handle?: string;
  /** Treatment template the story started from (see the editor's list). */
  template?: string;
  /** Treated teeth, FDI numbers ("11", "21", …). */
  teeth?: string[];
  /** Where in the mouth, e.g. "Rahang atas depan". */
  region?: string;
  /** The complaint/diagnosis treated, e.g. "Gigi berlubang". */
  condition?: string;
  /** Number of visits the treatment took. */
  visits?: number;
  /** False once the caption was typed by hand instead of built from the fields above. */
  autoCaption?: boolean;
}

/**
 * A marketing post the clinic makes in Konten — for now a before–after
 * story (1080 × 1920). Saved as a draft while being edited; publishing
 * stores the rendered image and shows it on the clinic website (/v1/contents).
 */
@Entity('clinic_contents')
@Index(['clinicId', 'status'])
export class ClinicContent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_id' })
  clinicId: number;

  /** Treatment name, the story's headline. */
  @Column({ length: 64 })
  title: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  caption: string | null;

  @Column({ type: 'enum', enum: ContentLayout, default: ContentLayout.STACK })
  layout: ContentLayout;

  @Column({
    type: 'enum',
    enum: ContentBackground,
    default: ContentBackground.LIGHT,
  })
  background: ContentBackground;

  @Column({ name: 'show_disclaimer', default: true })
  showDisclaimer: boolean;

  @Column({
    name: 'before_image_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  beforeImageUrl: string | null;

  @Column({
    name: 'after_image_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  afterImageUrl: string | null;

  @Column({ type: 'json', nullable: true })
  settings: ContentSettings | null;

  /** The rendered story, set when published. */
  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;

  @Column({ type: 'enum', enum: ContentStatus, default: ContentStatus.DRAFT })
  status: ContentStatus;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy: number | null;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updatedBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
