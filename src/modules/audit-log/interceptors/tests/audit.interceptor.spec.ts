import { of, throwError, lastValueFrom } from 'rxjs';
import { AuditInterceptor } from '../audit.interceptor';
import { AuditActionType, AuditStatus } from '../../entities/audit-log.entity';

describe('AuditInterceptor (VIEW)', () => {
  const auditLogService = { record: jest.fn() };
  const reflector = { get: jest.fn() };
  const interceptor = new AuditInterceptor(
    reflector as any,
    auditLogService as any,
  );
  const ctx = (request: any) =>
    ({
      getHandler: () => null,
      switchToHttp: () => ({ getRequest: () => request }),
    }) as any;
  const request = (params: any) => ({
    params,
    headers: {},
    ip: '10.0.0.1',
    user: { userId: 3, name: 'Dr. B', role: 'dokter', clinicId: 1 },
  });

  beforeEach(() => jest.clearAllMocks());

  it('records who read which patient, without copying the record (positive)', async () => {
    reflector.get.mockReturnValue({
      entityType: 'Patient',
      actionType: AuditActionType.VIEW,
      labelField: 'name',
    });
    const body = { success: true, data: { id: 9, name: 'Siti', nik: '3201234567890001' } };
    await lastValueFrom(
      interceptor.intercept(ctx(request({ id: '9' })), { handle: () => of(body) }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: AuditActionType.VIEW,
        entityId: '9',
        entityLabel: 'Siti',
        afterValue: null,
        actorId: 3,
      }),
    );
  });

  it('labels a list read by row count, not by search terms (positive)', async () => {
    reflector.get.mockReturnValue({
      entityType: 'Patient',
      actionType: AuditActionType.VIEW,
    });
    await lastValueFrom(
      interceptor.intercept(ctx(request({})), {
        handle: () => of({ data: [{ id: 1 }, { id: 2 }], meta: {} }),
      }),
    );
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: null, entityLabel: 'Daftar (2 data)', afterValue: null }),
    );
  });

  it('uses the parent encounter id for nested reads, and logs failures (negative)', async () => {
    reflector.get.mockReturnValue({
      entityType: 'SoapNote',
      actionType: AuditActionType.VIEW,
    });
    await expect(
      lastValueFrom(
        interceptor.intercept(ctx(request({ encounterId: '44' })), {
          handle: () => throwError(() => new Error('Not found')),
        }),
      ),
    ).rejects.toThrow('Not found');
    expect(auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: '44', status: AuditStatus.FAILED }),
    );
  });
});
