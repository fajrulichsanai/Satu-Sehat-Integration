import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { AuditLogService } from '../audit-log.service';
import { AuditActionType, AuditStatus } from '../entities/audit-log.entity';
import { AUDIT_KEY } from '../decorators/audit.decorator';
import { auditRoleOf } from '../../auth/branch-context';

const ACTION_BY_METHOD: Record<string, AuditActionType> = {
  POST: AuditActionType.CREATE,
  PUT: AuditActionType.UPDATE,
  PATCH: AuditActionType.UPDATE,
  DELETE: AuditActionType.DELETE,
};

/** "/tarif/12/items?x=1" → "tarif" (entity) and "12" (id, when numeric). */
export function describePath(url: string): {
  entityType: string;
  entityId: string | null;
} {
  const segments = url.split('?')[0].split('/').filter(Boolean);
  const entityType = (segments[0] ?? 'unknown').slice(0, 100);
  const id = segments.find((s) => /^\d+$/.test(s)) ?? null;
  return { entityType, entityId: id };
}

/**
 * PRD Multi-Klinik: setiap aksi owner multiklinik di mode Cabang aktif
 * tercatat di audit log cabang itu. Endpoints that already carry @Audit are
 * recorded by AuditInterceptor (with the real role, via auditRoleOf); this
 * covers every other change so nothing done inside a branch goes unlogged.
 * Reads are not recorded here — only POST/PUT/PATCH/DELETE.
 */
@Injectable()
export class BranchAuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest();
    const actionType = ACTION_BY_METHOD[request.method as string];
    const user = request.user;
    const alreadyAudited = this.reflector.get(AUDIT_KEY, context.getHandler());
    if (!actionType || !user?.branchMode || alreadyAudited) {
      return next.handle();
    }

    const { entityType, entityId } = describePath(
      request.originalUrl ?? request.url ?? '',
    );
    const base = {
      clinicId: user.clinicId ?? null,
      actorId: user.userId ?? null,
      actorName: user.name ?? 'Unknown',
      actorRole: auditRoleOf(user),
      actionType,
      entityType,
      entityId,
      entityLabel:
        `${request.method} ${String(request.originalUrl ?? request.url).split('?')[0]}`.slice(
          0,
          255,
        ),
      ipAddress: request.ip,
      userAgent: request.headers?.['user-agent'],
    };

    return next.handle().pipe(
      tap(() => {
        void this.auditLogService.record({
          ...base,
          status: AuditStatus.SUCCESS,
        });
      }),
      catchError((err) => {
        void this.auditLogService.record({
          ...base,
          status: AuditStatus.FAILED,
          failureReason: String(err?.message ?? '').slice(0, 255),
        });
        return throwError(() => err);
      }),
    );
  }
}
