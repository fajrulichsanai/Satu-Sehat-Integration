import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { NotificationsService } from '../notifications.service';
import { NOTIFY_KEY, NotifyMetadata } from '../decorators/notify.decorator';

/**
 * Reads @Notify(type, title) metadata off the handler and, once the request
 * succeeds, records a notification row — mirroring AuditInterceptor. Unlike
 * audit logging, a failed request creates no notification (nothing "new"
 * actually happened), so this only hooks the success path.
 */
@Injectable()
export class NotificationInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly notificationsService: NotificationsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<NotifyMetadata | undefined>(
      NOTIFY_KEY,
      context.getHandler(),
    );
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap((response) => {
        const payload = response?.data ?? response;
        const label = meta.labelField ? payload?.[meta.labelField] : undefined;

        void this.notificationsService.create({
          clinicId: request.clinicId ?? request.user?.clinicId ?? null,
          type: meta.type,
          title: meta.title,
          message: label ? String(label) : null,
          entityType: meta.type,
          entityId: payload?.id ?? null,
          actorId: request.user?.userId ?? null,
          actorName: request.user?.name ?? null,
        });
      }),
    );
  }
}
