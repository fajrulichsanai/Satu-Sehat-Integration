import { HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MfaEnforcementGuard } from '../mfa-enforcement.guard';
import { UserRole } from '../../../../enums';

function buildContext(user: unknown, skip = false) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
    // Only used indirectly via reflector mock below; kept for shape parity.
    __skip: skip,
  } as any;
}

describe('MfaEnforcementGuard', () => {
  let guard: MfaEnforcementGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    guard = new MfaEnforcementGuard(reflector as unknown as Reflector);
  });

  it('allows the request through when the route is marked @SkipMfaEnforcement (positive)', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const ctx = buildContext({ role: UserRole.OWNER, mfaEnabled: false });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows the request through when there is no user on the request (positive/edge)', () => {
    const ctx = buildContext(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows a non-enforced role through without MFA (positive)', () => {
    const ctx = buildContext({ role: UserRole.DOKTER, mfaEnabled: false });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows an enforced role through once MFA is enabled (positive)', () => {
    const ctx = buildContext({ role: UserRole.OWNER, mfaEnabled: true });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('blocks an enforced role without MFA enabled (negative)', () => {
    const ctx = buildContext({ role: UserRole.OWNER, mfaEnabled: false });
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
  });

  it('blocks SUPER_ADMIN without MFA enabled (negative)', () => {
    const ctx = buildContext({ role: UserRole.SUPER_ADMIN, mfaEnabled: false });
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
  });

  it('throws with the MFA_SETUP_REQUIRED error code (negative)', () => {
    const ctx = buildContext({ role: UserRole.ADMIN, mfaEnabled: false });
    try {
      guard.canActivate(ctx);
      fail('expected canActivate to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      const response = (err as HttpException).getResponse() as any;
      expect(response.error.code).toBe('MFA_SETUP_REQUIRED');
      expect((err as HttpException).getStatus()).toBe(403);
    }
  });
});
