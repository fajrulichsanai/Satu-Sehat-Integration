import { AppThrottlerGuard } from '../app-throttler.guard';

describe('AppThrottlerGuard.getTracker', () => {
  const jwtService = { verify: jest.fn() };
  const guard = new AppThrottlerGuard(
    { throttlers: [] } as any,
    {} as any,
    {} as any,
    jwtService as any,
  );
  const track = (req: any) => (guard as any).getTracker(req);

  it('buckets a signed-in request by user id (positive)', async () => {
    jwtService.verify.mockReturnValue({ sub: 42 });
    await expect(
      track({ ip: '1.2.3.4', headers: { authorization: 'Bearer good' } }),
    ).resolves.toBe('user:42');
  });

  it('falls back to the IP for a forged/invalid token (negative)', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    await expect(
      track({ ip: '1.2.3.4', headers: { authorization: 'Bearer forged' } }),
    ).resolves.toBe('ip:1.2.3.4');
  });

  it('does not treat an MFA challenge token as a signed-in user (negative)', async () => {
    jwtService.verify.mockReturnValue({ sub: 42, type: 'mfa_challenge' });
    await expect(
      track({ ip: '1.2.3.4', headers: { authorization: 'Bearer c' } }),
    ).resolves.toBe('ip:1.2.3.4');
  });

  it('uses the IP when there is no token (positive)', async () => {
    await expect(track({ ip: '5.6.7.8', headers: {} })).resolves.toBe(
      'ip:5.6.7.8',
    );
  });
});
