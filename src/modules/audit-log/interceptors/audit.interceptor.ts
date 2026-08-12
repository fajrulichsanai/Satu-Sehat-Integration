import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditLogService } from '../audit-log.service';
import { AuditStatus } from '../entities/audit-log.entity';
import { AUDIT_KEY, AuditMetadata } from '../decorators/audit.decorator';

/**
 * Reads @Audit(entityType, actionType) metadata off the handler and records a
 * row after the request settles. Controllers can additionally stash
 * `request.auditBefore` / `request.auditEntityLabel` before their handler
 * returns to attach a before-snapshot or a better label than the response body
 * provides (e.g. for DELETE, which usually returns no entity).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMetadata | undefined>(AUDIT_KEY, context.getHandler());
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap((response) => {
        const payload = response?.data ?? response;
        const entityId = request.params?.id ?? payload?.id ?? null;
        const entityLabel =
          request.auditEntityLabel ??
          (meta.labelField ? payload?.[meta.labelField] ?? request.body?.[meta.labelField] : undefined) ??
          null;

        void this.auditLogService.record({
          clinicId: request.clinicId ?? request.user?.clinicId ?? null,
          actorId: request.user?.userId ?? null,
          actorName: request.user?.name ?? 'Unknown',
          actorRole: request.user?.role ?? 'unknown',
          actionType: meta.actionType,
          entityType: meta.entityType,
          entityId,
          entityLabel,
          beforeValue: request.auditBefore ?? null,
          afterValue: meta.actionType === 'DELETE' ? null : payload ?? null,
          status: AuditStatus.SUCCESS,
          ipAddress: request.ip,
          userAgent: request.headers?.['user-agent'],
        });
      }),
      catchError((err) => {
        void this.auditLogService.record({
          clinicId: request.clinicId ?? request.user?.clinicId ?? null,
          actorId: request.user?.userId ?? null,
          actorName: request.user?.name ?? 'Unknown',
          actorRole: request.user?.role ?? 'unknown',
          actionType: meta.actionType,
          entityType: meta.entityType,
          entityId: request.params?.id ?? null,
          entityLabel: request.auditEntityLabel ?? null,
          beforeValue: request.auditBefore ?? null,
          status: AuditStatus.FAILED,
          failureReason: err?.message?.slice(0, 255),
          ipAddress: request.ip,
          userAgent: request.headers?.['user-agent'],
        });
        return throwError(() => err);
      }),
    );
  }
}
