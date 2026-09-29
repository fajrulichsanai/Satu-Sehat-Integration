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
import { User } from '../../users/entities/user.entity';

export enum DataRequestType {
  /** A copy of all of the clinic's data. */
  EXPORT = 'export',
  /** Close the clinic's account and delete its data (records still under the legal retention period are kept). */
  CLOSE_ACCOUNT = 'close_account',
}

export enum DataRequestStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

/**
 * A clinic owner's request under UU PDP to get a copy of the clinic's data
 * or to close the account. Handled by a super admin.
 */
@Entity('data_requests')
@Index(['clinicId', 'status'])
export class DataRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'requested_by_id' })
  requestedById: number;

  @Column({ type: 'enum', enum: DataRequestType })
  type: DataRequestType;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({
    type: 'enum',
    enum: DataRequestStatus,
    default: DataRequestStatus.PENDING,
  })
  status: DataRequestStatus;

  /** Super admin's note back to the clinic (what was done, or why it was refused). */
  @Column({ name: 'admin_note', type: 'text', nullable: true })
  adminNote: string | null;

  @Column({ name: 'handled_by_id', type: 'int', nullable: true })
  handledById: number | null;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy: User;
}
