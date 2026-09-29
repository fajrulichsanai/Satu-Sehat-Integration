import { SetMetadata } from '@nestjs/common';
import { NotificationType } from '../entities/notification.entity';

export const NOTIFY_KEY = 'notify';

export interface NotifyMetadata {
  type: NotificationType;
  title: string;
  /** Field on the response payload used to build the notification message (e.g. a patient's name). */
  labelField?: string;
}

/**
 * Marks a controller method for automatic notification creation by
 * NotificationInterceptor, mirroring how @Audit drives AuditInterceptor.
 * Usage: @Notify(NotificationType.PATIENT_NEW, 'Pasien baru terdaftar', { labelField: 'name' })
 */
export const Notify = (
  type: NotificationType,
  title: string,
  options?: { labelField?: string },
) =>
  SetMetadata(NOTIFY_KEY, {
    type,
    title,
    labelField: options?.labelField,
  });
