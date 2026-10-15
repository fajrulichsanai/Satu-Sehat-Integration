import { of, throwError, lastValueFrom } from 'rxjs';
import {
  BranchAuditInterceptor,
  describePath,
} from '../branch-audit.interceptor';
import { AuditActionType, AuditStatus } from '../../entities/audit-log.entity';

describe('BranchAuditInterceptor', () => {
  const auditLogService = { record: jest.fn() };
  const reflector = { get: jest.fn() };
  const interceptor = new BranchAuditInterceptor(
    reflector as any,
    auditLogService as any,
  );
  const ctx = (request: any) =>
    ({
      getType: () => 'http',
      getHandler: () => null,
      switchToHttp: () => ({ getRequest: () => request }),
    }) as any;
  const branchUser = {
    userId: 5,
    name: 'Bu Owner',
    role: 'owner',
    actorRole: 'multi_clinic_owner',
    clinicId: 12,
    branchMode: true,
  };
  const req = (method: string, user: any = branchUser) => ({
    method,
    originalUrl: '/tarif/33?x=1',
    headers: { 'user-agent': 'UA' },
    ip: '10.0.0.1',
    user,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.get.mockReturnValue(undefined);
  });

  it('records a change made inside a branch with the real role (positive)', async () => {
    await lastValueFrom(
      interceptor.intercept(ctx(req('PUT')), { handle: () => of({ ok: 1 }) }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 12,
        actorId: 5,
        actorRole: 'multi_clinic_owner',
        actionType: AuditActionType.UPDATE,
        entityType: 'tarif',
        entityId: '33',
        entityLabel: 'PUT /tarif/33',
        status: AuditStatus.SUCCESS,
      }),
    );
  });

  it('records a failed change too (negative)', async () => {
    await expect(
      lastValueFrom(
        interceptor.intercept(ctx(req('DELETE')), {
          handle: () => throwError(() => new Error('boom')),
        }),
      ),
    ).rejects.toThrow('boom');
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: AuditActionType.DELETE,
        status: AuditStatus.FAILED,
        failureReason: 'boom',
      }),
    );
  });

  it('skips reads, normal users and @Audit endpoints (edge)', async () => {
    const handle = () => of(null);
    await lastValueFrom(interceptor.intercept(ctx(req('GET')), { handle }));
    await lastValueFrom(
      interceptor.intercept(
        ctx(req('POST', { ...branchUser, branchMode: undefined })),
        { handle },
      ),
    );
    reflector.get.mockReturnValue({ entityType: 'Tarif' });
    await lastValueFrom(interceptor.intercept(ctx(req('POST')), { handle }));
    expect(auditLogService.record).not.toHaveBeenCalled();
  });

  it('describes paths without an id (edge)', () => {
    expect(describePath('/users')).toEqual({
      entityType: 'users',
      entityId: null,
    });
    expect(describePath('')).toEqual({ entityType: 'unknown', entityId: null });
  });
});
