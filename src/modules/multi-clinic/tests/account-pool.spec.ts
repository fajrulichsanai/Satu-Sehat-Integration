import { ForbiddenException } from '@nestjs/common';
import {
  assertAccountPoolHasRoom,
  assertAccountRoom,
  accountPoolForOwner,
  accountQuotaForClinic,
} from '../account-pool';

describe('account pool (PRD MK-07)', () => {
  const manager = (rows: unknown[][]) => {
    const query = jest.fn();
    rows.forEach((r) => query.mockResolvedValueOnce(r));
    return { query } as any;
  };

  it('is 25 accounts per active branch, shared by every branch (positive)', async () => {
    const pool = await accountPoolForOwner(
      manager([[{ branches: '3', used: '40' }]]),
      5,
    );
    expect(pool).toEqual({
      ownerId: 5,
      used: 40,
      limit: 75,
      activeBranches: 3,
    });
  });

  it('lets a linked branch add an account while the pool has room (positive)', async () => {
    const m = manager([[{ ownerId: 5 }], [{ branches: 2, used: 49 }]]);
    await expect(assertAccountPoolHasRoom(m, 10)).resolves.toBeUndefined();
  });

  it('refuses a new account once the shared pool is full (negative)', async () => {
    const m = manager([[{ ownerId: 5 }], [{ branches: 2, used: 50 }]]);
    await expect(assertAccountPoolHasRoom(m, 10)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('a clinic that is not linked uses its plan limit: Starter 5 (positive/negative)', async () => {
    // link lookup → none; active accounts; current plan
    let m = manager([[], [{ used: 4 }], [{ tier: 'basic', name: 'Starter', maxUsers: null }]]);
    await expect(assertAccountRoom(m, 10)).resolves.toBeUndefined();
    m = manager([[], [{ used: 5 }], [{ tier: 'basic', name: 'Starter', maxUsers: null }]]);
    await expect(assertAccountRoom(m, 10)).rejects.toMatchObject({
      response: { error: { code: 'ACCOUNT_LIMIT_REACHED', message: expect.stringContaining('Naik ke paket Pro') } },
    });
  });

  it('Pro and the trial allow 25; a plan max_users overrides; no plan = Starter (edge)', async () => {
    let q = await accountQuotaForClinic(manager([[], [{ used: 24 }], [{ tier: 'pro', maxUsers: null }]]), 10);
    expect(q).toMatchObject({ scope: 'clinic', used: 24, limit: 25 });
    q = await accountQuotaForClinic(manager([[], [{ used: 0 }], [{ tier: 'trial', maxUsers: null }]]), 10);
    expect(q.limit).toBe(25);
    q = await accountQuotaForClinic(manager([[], [{ used: 0 }], [{ tier: 'pro', maxUsers: 40 }]]), 10);
    expect(q.limit).toBe(40);
    q = await accountQuotaForClinic(manager([[], [{ used: 0 }], []]), 10);
    expect(q.limit).toBe(5);
  });

  it('skips without a manager or clinic (edge)', async () => {
    await expect(
      assertAccountPoolHasRoom(undefined, 10),
    ).resolves.toBeUndefined();
    await expect(
      assertAccountPoolHasRoom(manager([]), null),
    ).resolves.toBeUndefined();
  });
});
