import { ApiKeysService, hashKey } from '../api-keys.service';
import { ApiKeyType } from '../entities/api-key.entity';
import { SubscriptionPlanTier } from '../../subscriptions/entities/subscription-plan.entity';

const PK = 'apx_pk_testkey';
const SK = 'apx_sk_testkey';

function makeService(opts: { tier?: SubscriptionPlanTier; endDate?: string; usedToday?: number } = {}) {
  const keys = [
    { id: 1, clinicId: 7, type: ApiKeyType.PUBLISHABLE, keyHash: hashKey(PK), allowedOrigins: ['https://klinik.web.app'], revokedAt: null },
    { id: 2, clinicId: 7, type: ApiKeyType.SECRET, keyHash: hashKey(SK), allowedOrigins: null, revokedAt: null },
  ];
  const apiKeyRepository = {
    findOne: jest.fn(({ where }) => Promise.resolve(keys.find((k) => k.keyHash === where.keyHash) ?? null)),
    update: jest.fn(),
  };
  const usageRepository = {
    query: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: String(opts.usedToday ?? 0) }),
    })),
  };
  const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const subs = {
    getCurrentForClinic: jest.fn().mockResolvedValue({
      endDate: opts.endDate ?? future,
      plan: { tier: opts.tier ?? SubscriptionPlanTier.BASIC },
    }),
  };
  const config = { get: jest.fn((_k: string, d: string) => d) };
  const service = new ApiKeysService(apiKeyRepository as any, usageRepository as any, subs as any, config as any);
  return { service, keys };
}

const code = (p: Promise<unknown>) =>
  p.then(() => 'OK', (e) => e.getResponse?.().error?.code ?? e.message);

describe('ApiKeysService.authenticate', () => {
  it('accepts a publishable key from a registered domain and reports remaining quota (positive)', async () => {
    const { service } = makeService();
    const res = await service.authenticate(PK, 'https://klinik.web.app');
    expect(res.apiKey.clinicId).toBe(7);
    expect(res.usage.limitPerDay).toBe(1000);
    expect(res.usage.remainingToday).toBe(999);
  });

  it('rejects a missing, unknown or revoked key (negative)', async () => {
    const { service, keys } = makeService();
    expect(await code(service.authenticate(undefined, undefined))).toBe('API_KEY_MISSING');
    expect(await code(service.authenticate('apx_pk_nope', 'https://klinik.web.app'))).toBe('API_KEY_INVALID');
    (keys[0] as any).revokedAt = new Date();
    expect(await code(service.authenticate(PK, 'https://klinik.web.app'))).toBe('API_KEY_INVALID');
  });

  it('rejects a publishable key from another domain or with no Origin (negative)', async () => {
    const { service } = makeService();
    expect(await code(service.authenticate(PK, 'https://evil.example'))).toBe('ORIGIN_NOT_ALLOWED');
    expect(await code(service.authenticate(PK, undefined))).toBe('ORIGIN_NOT_ALLOWED');
  });

  it('accepts a secret key server-side but refuses it from a browser (edge)', async () => {
    const { service } = makeService();
    expect(await code(service.authenticate(SK, undefined))).toBe('OK');
    expect(await code(service.authenticate(SK, 'https://klinik.web.app'))).toBe('SECRET_KEY_IN_BROWSER');
  });

  it('turns the API off when the subscription is past its grace period (negative)', async () => {
    const { service } = makeService({ endDate: '2020-01-01' });
    expect(await code(service.authenticate(SK, undefined))).toBe('SUBSCRIPTION_INACTIVE');
  });

  it('enforces the per-minute limit of the plan (negative)', async () => {
    const { service } = makeService({ tier: SubscriptionPlanTier.BASIC });
    for (let i = 0; i < 60; i++) await service.authenticate(SK, undefined);
    expect(await code(service.authenticate(SK, undefined))).toBe('RATE_LIMITED');
  });

  it('enforces the daily quota across all of the clinic’s keys (negative)', async () => {
    const { service } = makeService({ tier: SubscriptionPlanTier.PRO, usedToday: 9999 });
    expect(await code(service.authenticate(SK, undefined))).toBe('OK');
    expect(await code(service.authenticate(PK, 'https://klinik.web.app'))).toBe('QUOTA_EXCEEDED');
  });

  it('gives Multi Klinik its higher limits (positive)', async () => {
    const { service } = makeService({ tier: SubscriptionPlanTier.MULTI_KLINIK });
    const res = await service.authenticate(SK, undefined);
    expect(res.usage.limitPerDay).toBe(1_000_000);
    expect(res.usage.limitPerMinute).toBe(2000);
  });
});
