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
import {
  ContentBackground,
  ContentLayout,
  type ContentSettings,
} from './clinic-content.entity';

/**
 * A clinic's template for one treatment (Tambal, Cabut, Scaling, …): the
 * story's text and look. A new story starts from it and only needs its own
 * photos (and, if wanted, its own caption). Stories made from it are grouped
 * under its name in the Konten gallery and on the clinic website.
 */
@Entity('content_templates')
@Index(['clinicId'])
export class ContentTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_id' })
  clinicId: number;

  /** Treatment name, the gallery group (e.g. "Tambal"). */
  @Column({ length: 40 })
  name: string;

  /** Headline on the story (defaults to the name). */
  @Column({ length: 64 })
  title: string;

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

  /** Same shape as a story's settings (photo frames are not used). */
  @Column({ type: 'json', nullable: true })
  settings: ContentSettings | null;

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
