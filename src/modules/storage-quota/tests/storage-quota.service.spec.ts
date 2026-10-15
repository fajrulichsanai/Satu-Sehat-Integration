import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  StorageQuotaService,
  formatBytes,
  freeUntilAfterMonths,
  localDate,
} from '../storage-quota.service';
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

  it('uses the plan tier default for a single clinic (Starter 1 GB, Pro 5 GB, trial 100 MB) (positive)', async () => {
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
    // Masa coba = Starter dengan 100 MB.
    answer({ tier: 'trial' });
    expect((await service.quotaForClinic(1)).limitBytes).toBe(
      Math.round(0.1 * GB),
    );
  });

  it('a multiklinik branch shares 5 GB × active branches with its siblings (positive)', async () => {
    answer({ link: true, clinicUsed: 300, branches: 3, poolUsed: 2 * GB });
    expect(await service.quotaForClinic(1)).toEqual({
      scope: 'multiklinik',
      limitBytes: 15 * GB,
      usedBytes: 2 * GB,
      clinicUsedBytes: 300,
      activeBranches: 3,
      includedGb: 15,
      extraGb: 0,
      billableExtraGb: 0,
      bonuses: [],
      pricePerGb: 10000,
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

describe('StorageQuotaService — storage tambahan (BL-05)', () => {
  type Row = {
    id: number;
    clinicId: number | null;
    ownerId: number | null;
    gb: number;
    isFree: boolean;
    freeUntil: string | null;
  };
  let rows: Row[];
  let ds: { query: jest.Mock };
  let addons: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let audit: { record: jest.Mock };
  let service: StorageQuotaService;
  let linkedTo: number | null = null;
  let usedBytes = 0;

  const scoped = (sql: string, param: number) =>
    rows.filter((r) =>
      sql.includes('owner_id = ?') ? r.ownerId === param : r.clinicId === param,
    );

  beforeEach(() => {
    rows = [];
    linkedTo = null;
    usedBytes = 0;
    ds = {
      query: jest.fn((sql: string, params: any[] = []) => {
        if (sql.includes('FROM owner_clinic_links') && sql.includes('LIMIT 1'))
          return Promise.resolve(linkedTo ? [{ ownerId: linkedTo }] : []);
        if (sql.includes('AS billable')) {
          const [today, param] = params;
          const mine = scoped(sql, param);
          return Promise.resolve([
            {
              total: mine.reduce((a, r) => a + r.gb, 0),
              billable: mine
                .filter(
                  (r) =>
                    !r.isFree || (r.freeUntil !== null && r.freeUntil < today),
                )
                .reduce((a, r) => a + r.gb, 0),
            },
          ]);
        }
        if (sql.includes('is_free = 1 AND (free_until IS NULL')) {
          const [param, today] = params;
          return Promise.resolve(
            scoped(sql, param)
              .filter(
                (r) =>
                  r.isFree && (r.freeUntil === null || r.freeUntil >= today),
              )
              .map((r) => ({ id: r.id, gb: r.gb, freeUntil: r.freeUntil })),
          );
        }
        if (sql.includes('AS branches'))
          return Promise.resolve([{ branches: 2, used: usedBytes }]);
        if (sql.includes('FROM clinic_subscriptions'))
          return Promise.resolve([{ tier: 'basic', storageGb: null }]);
        return Promise.resolve([{ used: usedBytes }]);
      }),
    };
    addons = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => {
        const row = {
          id: rows.length + 1,
          isFree: false,
          freeUntil: null,
          ...x,
        };
        rows.push(row);
        return Promise.resolve(row);
      }),
      findOne: jest.fn(({ where }) =>
        Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
      ),
      delete: jest.fn(({ id }) => {
        rows = rows.filter((r) => r.id !== id);
        return Promise.resolve({});
      }),
    };
    audit = { record: jest.fn() };
    service = new StorageQuotaService(
      {} as any,
      ds as any,
      addons as any,
      audit as any,
    );
  });

  const owner = { userId: 1, role: 'owner', clinicId: 9 };

  it('a clinic owner buys storage for their clinic; the limit grows at once (positive)', async () => {
    const q = await service.purchase(owner, 3);
    expect(addons.save).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: 9,
        ownerId: null,
        gb: 3,
        source: 'purchase',
      }),
    );
    expect(q).toMatchObject({
      scope: 'clinic',
      includedGb: 1,
      extraGb: 3,
      limitBytes: 4 * GB,
    });
    expect(audit.record).toHaveBeenCalled();
  });

  it('rejects an invalid amount (negative)', async () => {
    for (const gb of [0, -1, 1.5, 101]) {
      await expect(service.purchase(owner, gb)).rejects.toThrow(
        BadRequestException,
      );
    }
  });

  it('a branch owner/manager cannot buy for the shared pool; the multiklinik owner can (security)', async () => {
    linkedTo = 5;
    await expect(service.purchase(owner, 2)).rejects.toThrow(
      ForbiddenException,
    );
    const q = await service.purchase(
      { userId: 5, role: 'owner', clinicId: 9, branchMode: true },
      2,
    );
    expect(addons.save).toHaveBeenCalledWith(
      expect.objectContaining({ ownerId: 5, clinicId: null }),
    );
    expect(q).toMatchObject({
      scope: 'multiklinik',
      includedGb: 10,
      extraGb: 2,
    });
    const q2 = await service.purchase(
      { userId: 5, role: 'multi_clinic_owner' },
      1,
    );
    expect(q2.extraGb).toBe(3);
  });

  it('only the clinic, not the branch, is billed for its own add-ons (positive)', async () => {
    rows.push({
      id: 1,
      clinicId: 9,
      ownerId: null,
      gb: 4,
      isFree: false,
      freeUntil: null,
    });
    expect(await service.extraGbToBillForClinic(9)).toBe(4);
    linkedTo = 5;
    expect(await service.extraGbToBillForClinic(9)).toBe(0);
  });

  it('Super Admin adds and removes storage, never below zero (positive/negative)', async () => {
    const sa = { userId: 99, role: 'super_admin' };
    await service.adminAdjust(sa, { clinicId: 9 }, 5, 'kompensasi');
    expect(addons.save).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'admin', gb: 5, note: 'kompensasi' }),
    );
    await service.adminAdjust(sa, { clinicId: 9 }, -2);
    expect(await service.extraGb({ clinicId: 9 })).toBe(3);
    await expect(service.adminAdjust(sa, { clinicId: 9 }, -4)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.adminAdjust(sa, {}, 1)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.adminAdjust(sa, { clinicId: 9, ownerId: 5 }, 1),
    ).rejects.toThrow(BadRequestException);
    await expect(service.adminAdjust(sa, { clinicId: 9 }, 0)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('a bonus raises the limit but is not billed while free, then is billed (positive)', async () => {
    const sa = { userId: 99, role: 'super_admin' };
    const q = await service.adminAdjust(
      sa,
      { clinicId: 9 },
      3,
      'pelanggan awal',
      { freeMonths: 3 },
    );
    expect(q).toMatchObject({
      extraGb: 3,
      billableExtraGb: 0,
      limitBytes: 4 * GB,
    });
    expect(q.bonuses).toEqual([
      { id: 1, gb: 3, freeUntil: freeUntilAfterMonths(3) },
    ]);
    expect(await service.extraGbToBillForClinic(9)).toBe(0);
    // After the free period the GB stay and are billed.
    const later = new Date();
    later.setMonth(later.getMonth() + 4);
    const after = await service.addonSummary({ clinicId: 9 }, localDate(later));
    expect(after).toMatchObject({
      extraGb: 3,
      billableExtraGb: 3,
      bonuses: [],
    });
  });

  it('a bonus free forever is never billed; a billed add-on is (edge)', async () => {
    const sa = { userId: 99, role: 'super_admin' };
    await service.adminAdjust(sa, { clinicId: 9 }, 2, undefined, {
      freeMonths: null,
    });
    await service.adminAdjust(sa, { clinicId: 9 }, 1);
    const far = await service.addonSummary({ clinicId: 9 }, '2099-01-01');
    expect(far).toMatchObject({ extraGb: 3, billableExtraGb: 1 });
  });

  it('rejects a negative bonus or an invalid free period (negative)', async () => {
    const sa = { userId: 99, role: 'super_admin' };
    await expect(
      service.adminAdjust(sa, { clinicId: 9 }, -1, undefined, {
        freeMonths: 3,
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.adminAdjust(sa, { clinicId: 9 }, 1, undefined, { freeMonths: 0 }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.adminAdjust(sa, { clinicId: 9 }, 1, undefined, {
        freeMonths: 40,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('Super Admin revokes a bonus unless the storage is in use (positive/negative)', async () => {
    const sa = { userId: 99, role: 'super_admin' };
    await service.adminAdjust(sa, { clinicId: 9 }, 3, undefined, {
      freeMonths: 3,
    });
    usedBytes = 2 * GB; // Starter 1 GB + 3 GB bonus = 4 GB; without bonus only 1 GB
    await expect(service.revokeBonus(sa, 1)).rejects.toThrow(
      BadRequestException,
    );
    usedBytes = 0;
    await service.revokeBonus(sa, 1);
    expect(await service.extraGb({ clinicId: 9 })).toBe(0);
    await service.adminAdjust(sa, { clinicId: 9 }, 1);
    await expect(service.revokeBonus(sa, 2)).rejects.toThrow(
      BadRequestException,
    ); // not a bonus
  });
});

describe('StorageQuotaService — bonus gratis', () => {
  it('computes the last free day: 3 months from 15 Oct = 14 Jan (positive)', () => {
    expect(freeUntilAfterMonths(3, new Date(2026, 9, 15))).toBe('2027-01-14');
    expect(freeUntilAfterMonths(1, new Date(2026, 0, 31))).toBe('2026-03-02');
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
