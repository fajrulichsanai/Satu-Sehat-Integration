import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
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
    const user = await strategy.validate(undefined, {
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
    await expect(
      strategy.validate(undefined, { sub: 1, tv: 1 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a revoked token (negative)', async () => {
    authService.isTokenRevoked.mockResolvedValue(true);
    await expect(
      strategy.validate(undefined, { sub: 1, tv: 2, jti: 'j' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  describe('mode cabang aktif (Multi-Klinik Owner)', () => {
    const owner = {
      ...row,
      id: 5,
      role: UserRole.MULTI_CLINIC_OWNER,
      clinicId: null,
      practitionerId: null,
    };
    let links: { findOne: jest.Mock };
    const req = (header?: string, path = '/patients') =>
      ({ headers: header ? { 'x-clinic-id': header } : {}, path }) as any;

    beforeEach(() => {
      authService.validateUser.mockResolvedValue(owner);
      links = { findOne: jest.fn().mockResolvedValue({ id: 1 }) };
      strategy = new JwtStrategy(
        { getOrThrow: () => 'secret' } as any,
        authService as any,
        links as any,
      );
    });

    it('acts as owner of an approved branch (positive)', async () => {
      const user = await strategy.validate(req('12'), { sub: 5, tv: 2 });
      expect(user).toMatchObject({
        userId: 5,
        role: UserRole.OWNER,
        clinicId: 12,
        actorRole: UserRole.MULTI_CLINIC_OWNER,
        branchMode: true,
      });
      expect(links.findOne).toHaveBeenCalledWith({
        where: { ownerId: 5, clinicId: 12, status: 'approved' },
      });
    });

    it('refuses a branch owned by someone else or not yet approved (negative)', async () => {
      links.findOne.mockResolvedValue(null);
      await expect(
        strategy.validate(req('99'), { sub: 5, tv: 2 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('stays the multi-klinik owner without a header (edge)', async () => {
      const user = await strategy.validate(req(), { sub: 5, tv: 2 });
      expect(user.role).toBe(UserRole.MULTI_CLINIC_OWNER);
      expect(user.clinicId).toBeNull();
      expect(links.findOne).not.toHaveBeenCalled();
    });

    it('ignores the header on owner-scoped routes (edge)', async () => {
      for (const path of ['/multi-clinic/dashboard', '/auth/me']) {
        const user = await strategy.validate(req('12', path), {
          sub: 5,
          tv: 2,
        });
        expect(user.role).toBe(UserRole.MULTI_CLINIC_OWNER);
      }
      expect(links.findOne).not.toHaveBeenCalled();
    });

    it('ignores a malformed header (edge)', async () => {
      for (const bad of ['abc', '-1', '0', '1 OR 1=1']) {
        const user = await strategy.validate(req(bad), { sub: 5, tv: 2 });
        expect(user.role).toBe(UserRole.MULTI_CLINIC_OWNER);
      }
    });

    it('never switches clinic for other roles, even with the header (security)', async () => {
      authService.validateUser.mockResolvedValue({
        ...row,
        role: UserRole.OWNER,
      });
      const user = await strategy.validate(req('12'), { sub: 1, tv: 2 });
      expect(user.role).toBe(UserRole.OWNER);
      expect(user.clinicId).toBe(7);
      expect(links.findOne).not.toHaveBeenCalled();
    });
  });
});
