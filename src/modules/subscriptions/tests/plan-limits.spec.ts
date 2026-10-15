import {
  planLimitsForClinic,
  trialProFrom,
  trialStage,
} from '../limits/plan-limits';

describe('plan limits — masa coba', () => {
  it('uses Starter limits for the first 7 days (positive)', () => {
    expect(trialStage('2026-10-01', '2026-10-01')).toBe('starter');
    expect(trialStage('2026-10-01', '2026-10-07')).toBe('starter');
  });

  it('moves to Pro limits from day 8 (edge)', () => {
    expect(trialStage('2026-10-01', '2026-10-08')).toBe('pro');
    expect(trialProFrom('2026-10-01')).toBe('2026-10-08');
  });

  it('gives a second-week trial 25 accounts but keeps 100 MB storage (positive)', async () => {
    const start = new Date();
    start.setDate(start.getDate() - 9);
    const iso = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
    const manager = {
      query: jest.fn().mockResolvedValue([
        {
          tier: 'trial',
          name: 'Free Trial',
          maxUsers: null,
          storageGb: null,
          startDate: iso,
        },
      ]),
    };
    await expect(planLimitsForClinic(manager, 1)).resolves.toMatchObject({
      tier: 'trial',
      trialStage: 'pro',
      maxUsers: 25,
      storageGb: 0.1,
    });
  });

  it('keeps a first-week trial at 5 accounts (negative)', async () => {
    const manager = {
      query: jest.fn().mockResolvedValue([
        {
          tier: 'trial',
          name: 'Free Trial',
          maxUsers: null,
          storageGb: null,
          startDate: new Date().toISOString().slice(0, 10),
        },
      ]),
    };
    await expect(planLimitsForClinic(manager, 1)).resolves.toMatchObject({
      trialStage: 'starter',
      maxUsers: 5,
    });
  });
});
