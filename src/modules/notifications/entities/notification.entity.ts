import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum NotificationType {
  PATIENT_NEW = 'PATIENT_NEW',
  KUNJUNGAN_NEW = 'KUNJUNGAN_NEW',
  PAYMENT_NEW = 'PAYMENT_NEW',
  USER_JOINED = 'USER_JOINED',
}

/**
 * In-app notification feed, one row per event (new patient, new encounter,
 * new payment, new staff invited). Append-only from the app's perspective —
 * the only mutation is flipping `isRead`. Never extends BaseEntity (no
 * updatedBy/createdBy) since these are system-generated, not user-edited.
 */
@Entity('notifications')
@Index(['clinicId', 'createdAt'])
@Index(['clinicId', 'isRead'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_id', type: 'int' })
  clinicId: number;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  @Column({ length: 150 })
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  message: string | null;

  @Column({ name: 'entity_type', type: 'varchar', length: 100, nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', type: 'varchar', length: 100, nullable: true })
  entityId: string | null;

  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actorId: number | null;

  @Column({ name: 'actor_name', type: 'varchar', length: 150, nullable: true })
  actorName: string | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
