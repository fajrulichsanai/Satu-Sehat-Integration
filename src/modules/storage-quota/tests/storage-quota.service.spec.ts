import { ForbiddenException } from '@nestjs/common';
import { StorageQuotaService, formatBytes } from '../storage-quota.service';
import { StorageReconcileService } from '../storage-reconcile.service';
import { StorageKind } from '../storage-usage.entity';
import { GB } from '../storage-quota.constants';

describe('StorageQuotaService', () => {
  let repo: { upsert: jest.Mock; delete: jest.Mock };
  let ds: { query: jest.Mock };
  let service: StorageQuotaService;

  /** Routes the service's SQL by what it asks for. */
  const answer = (opts: {
    link?: boolean;
    clinicUsed?: number;
    tier?: string;
    storageGb?: number | null;
    branches?: number;
    poolUsed?: number;
  }) =>
    ds.query.mockImplementation((sql: string) => {
      if (sql.includes('FROM owner_clinic_links') && sql.includes('LIMIT 1'))
        return Promise.resolve(opts.link ? [{ ownerId: 5 }] : []);
      if (sql.includes('AS branches'))
        return Promise.resolve([
          {
            branches: String(opts.branches ?? 0),
            used: String(opts.poolUsed ?? 0),
          },
        ]);
      if (sql.includes('FROM storage_usage WHERE clinic_id'))
        return Promise.resolve([{ used: String(opts.clinicUsed ?? 0) }]);
      if (sql.includes('FROM clinic_subscriptions'))
        return Promise.resolve(
          opts.tier
            ? [{ tier: opts.tier, storageGb: opts.storageGb ?? null }]
            : [],
        );
      return Promise.resolve([]);
    });

  beforeEach(() => {
    repo = {
      upsert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    ds = { query: jest.fn() };
    service = new StorageQuotaService(repo as any, ds as any);
  });

  it('uses the plan tier default for a single clinic (Starter 1 GB, Pro 5 GB) (positive)', async () => {
    answer({ tier: 'basic', clinicUsed: 100 });
    expect(await service.quotaForClinic(1)).toMatchObject({
      scope: 'clinic',
      limitBytes: GB,
      usedBytes: 100,
    });
    answer({ tier: 'pro' });
    expect((await service.quotaForClinic(1)).limitBytes).toBe(5 * GB);
  });

  it('a plan storage_gb overrides the tier default; no subscription = 1 GB (edge)', async () => {
    answer({ tier: 'pro', storageGb: 20 });
    expect((await service.quotaForClinic(1)).limitBytes).toBe(20 * GB);
    answer({});
    expect((await service.quotaForClinic(1)).limitBytes).toBe(GB);
  });

  it('a multiklinik branch shares 5 GB × active branches with its siblings (positive)', async () => {
    answer({ link: true, clinicUsed: 300, branches: 3, poolUsed: 2 * GB });
    expect(await service.quotaForClinic(1)).toEqual({
      scope: 'multiklinik',
      limitBytes: 15 * GB,
      usedBytes: 2 * GB,
      clinicUsedBytes: 300,
      activeBranches: 3,
    });
  });

  it('refuses an upload that would exceed the quota (negative)', async () => {
    answer({ tier: 'basic', clinicUsed: GB - 10 });
    await expect(service.assertRoom(1, 5)).resolves.toBeUndefined();
    await expect(service.assertRoom(1, 11)).rejects.toThrow(ForbiddenException);
  });

  it('records and forgets files without ever throwing (edge)', async () => {
    await service.record(1, StorageKind.CONTENT, '/files/x.jpg', 1234.6);
    expect(repo.upsert).toHaveBeenCalledWith(
      { clinicId: 1, kind: 'content', ref: '/files/x.jpg', bytes: 1235 },
      ['kind', 'ref'],
    );
    repo.upsert.mockRejectedValue(new Error('db down'));
    await expect(
      service.record(1, StorageKind.CONTENT, 'r', 1),
    ).resolves.toBeUndefined();
    repo.delete.mockRejectedValue(new Error('db down'));
    await expect(
      service.forget(StorageKind.CONTENT, 'r'),
    ).resolves.toBeUndefined();
  });

  it('formats sizes for messages (edge)', () => {
    expect(formatBytes(1.5 * GB)).toBe('1,5 GB');
    expect(formatBytes(5 * 1024 ** 2)).toBe('5 MB');
  });
});

describe('StorageReconcileService', () => {
  it('records unmetered files and drops stale rows (positive)', async () => {
    const quota = { record: jest.fn().mockResolvedValue(undefined) };
    const ds = {
      query: jest
        .fn()
        .mockResolvedValueOnce([
          { ref: '/uploads/supporting-exam/a.jpg', clinicId: 1 },
        ])
        .mockResolvedValueOnce([
          { ref: '/files/contents/1/b.jpg', clinicId: 1 },
          { ref: '/files/missing.jpg', clinicId: 1 },
        ])
        .mockResolvedValueOnce({ affectedRows: 2 }),
    };
    const svc = new StorageReconcileService(ds as any, quota as any);
    jest
      .spyOn(svc, 'sizeOf')
      .mockImplementation((ref: string) =>
        Promise.resolve(ref.includes('missing') ? null : 500),
      );

    const res = await svc.reconcile();

    expect(res).toEqual({ added: 2, removed: 2 });
    expect(quota.record).toHaveBeenCalledWith(
      1,
      StorageKind.SUPPORTING_EXAM,
      '/uploads/supporting-exam/a.jpg',
      500,
    );
    expect(quota.record).toHaveBeenCalledWith(
      1,
      StorageKind.CONTENT,
      '/files/contents/1/b.jpg',
      500,
    );
  });

  it('refuses paths that escape the upload folders (security)', async () => {
    const svc = new StorageReconcileService({} as any, {} as any);
    await expect(svc.sizeOf('/uploads/../.env')).resolves.toBeNull();
    await expect(svc.sizeOf('/etc/passwd')).resolves.toBeNull();
  });
});
