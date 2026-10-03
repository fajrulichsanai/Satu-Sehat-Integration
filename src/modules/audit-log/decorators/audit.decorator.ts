import { SetMetadata } from '@nestjs/common';
import { AuditActionType } from '../entities/audit-log.entity';

export const AUDIT_KEY = 'audit';

export interface AuditMetadata {
  entityType: string;
  actionType: AuditActionType;
  /** Field on the response payload (or request body, for DELETE) used as the human-readable label. */
  labelField?: string;
}

/**
 * Marks a controller method for automatic audit logging by AuditInterceptor.
 * Usage: @Audit('Patient', AuditActionType.CREATE, { labelField: 'name' })
 */
export const Audit = (entityType: string, actionType: AuditActionType, options?: { labelField?: string }) =>
  SetMetadata(AUDIT_KEY, { entityType, actionType, labelField: options?.labelField } as AuditMetadata);
