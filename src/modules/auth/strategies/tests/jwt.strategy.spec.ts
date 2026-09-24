import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../jwt.strategy';
import { UserRole } from '../../../../enums';

describe('JwtStrategy.validate', () => {
  let authService: { validateUser: jest.Mock; isTokenRevoked: jest.Mock };
  let strategy: JwtStrategy;
  const row = {
    id: 1,
    email: 'a@x.com',
    name: 'A',
    role: UserRole.DOKTER,
    clinicId: 7,
    practitionerId: 3,
    isActive: true,
    mfaEnabled: false,
    tokenVersion: 2,
  };

  beforeEach(() => {
    authService = {
      validateUser: jest.fn().mockResolvedValue(row),
      isTokenRevoked: jest.fn().mockResolvedValue(false),
    };
    strategy = new JwtStrategy(
      { getOrThrow: () => 'secret' } as any,
      authService as any,
    );
  });

  it('takes role and clinic from the user row, not the token (positive)', async () => {
    const user = await strategy.validate({
      sub: 1,
      role: UserRole.OWNER,
      clinicId: 99,
      tv: 2,
      jti: 'j',
    });
    expect(user.role).toBe(UserRole.DOKTER);
    expect(user.clinicId).toBe(7);
    expect(user.impersonated).toBe(false);
  });

  it('rejects a token issued before the last token_version bump (negative)', async () => {
    await expect(strategy.validate({ sub: 1, tv: 1 })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a revoked token (negative)', async () => {
    authService.isTokenRevoked.mockResolvedValue(true);
    await expect(
      strategy.validate({ sub: 1, tv: 2, jti: 'j' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an MFA challenge token (negative)', async () => {
    await expect(
      strategy.validate({ sub: 1, type: 'mfa_challenge' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
