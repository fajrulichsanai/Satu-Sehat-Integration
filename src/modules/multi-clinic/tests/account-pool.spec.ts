import { ForbiddenException } from '@nestjs/common';
import { assertAccountPoolHasRoom, accountPoolForOwner } from '../account-pool';

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

  it('does not limit a clinic that is not linked (edge)', async () => {
    const m = manager([[]]);
    await expect(assertAccountPoolHasRoom(m, 10)).resolves.toBeUndefined();
    expect(m.query).toHaveBeenCalledTimes(1);
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
