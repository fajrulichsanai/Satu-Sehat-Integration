import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum AuditActionType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  EXPORT = 'EXPORT',
  VIEW = 'VIEW',
}

export enum AuditStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
}

/**
 * Append-only audit trail. Never extends BaseEntity (no updatedAt/updatedBy) and
 * must never gain an update/delete path — integrity of the log depends on it.
 */
@Entity('audit_logs')
@Index(['clinicId', 'createdAt'])
@Index(['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_id', type: 'int', nullable: true })
  @Index()
  clinicId: number | null;

  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actorId: number | null;

  @Column({ name: 'actor_name', length: 150 })
  actorName: string;

  @Column({ name: 'actor_role', length: 50 })
  actorRole: string;

  @Column({ name: 'action_type', type: 'enum', enum: AuditActionType })
  actionType: AuditActionType;

  @Column({ name: 'entity_type', length: 100 })
  entityType: string;

  @Column({ name: 'entity_id', length: 100, nullable: true })
  entityId: string | null;

  @Column({ name: 'entity_label', length: 255, nullable: true })
  entityLabel: string | null;

  @Column({ name: 'before_value', type: 'json', nullable: true })
  beforeValue: Record<string, unknown> | null;

  @Column({ name: 'after_value', type: 'json', nullable: true })
  afterValue: Record<string, unknown> | null;

  @Column({ type: 'enum', enum: AuditStatus, default: AuditStatus.SUCCESS })
  status: AuditStatus;

  @Column({ name: 'failure_reason', length: 255, nullable: true })
  failureReason: string | null;

  @Column({ name: 'ip_address', length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', length: 255, nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
