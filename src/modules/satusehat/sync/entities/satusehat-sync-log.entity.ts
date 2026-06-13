import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../../common/base.entity';
import { Clinic } from '../../../clinics/entities/clinic.entity';

export enum SyncOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
}

export enum SyncLogStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PENDING = 'pending',
}

@Entity('satusehat_sync_logs')
@Index(['clinicId'])
@Index(['resourceType', 'localId'])
@Index(['status'])
export class SatusehatSyncLog extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'resource_type', length: 50 })
  resourceType: string;

  @Column({ name: 'local_id' })
  localId: number;

  @Column({ name: 'satusehat_id', length: 100, nullable: true })
  satusehatId: string;

  @Column({ type: 'enum', enum: SyncOperation })
  operation: SyncOperation;

  @Column({ type: 'enum', enum: SyncLogStatus })
  status: SyncLogStatus;

  @Column({ name: 'http_status', nullable: true })
  httpStatus: number;

  @Column({ name: 'request_payload', type: 'json', nullable: true })
  requestPayload: object;

  @Column({ name: 'response_payload', type: 'json', nullable: true })
  responsePayload: object;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'last_retry_at', nullable: true })
  lastRetryAt: Date;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
