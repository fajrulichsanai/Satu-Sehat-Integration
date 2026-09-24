import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { User } from '../../users/entities/user.entity';
import { RevokedToken } from '../entities/revoked-token.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { OwnerCodeService } from '../../owner-code/owner-code.service';
import { ClinicSubscriptionsService } from '../../subscriptions/clinic-subscriptions.service';
import { MfaService } from '../mfa.service';
import { UserRole } from '../../../enums';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'mock-email' }) },
  })),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-value'),
  compare: jest.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let clinicRepo: { create: jest.Mock; save: jest.Mock };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let ownerCodeService: { validate: jest.Mock; markAsUsed: jest.Mock };
  let subscriptionsService: { provisionTrialForNewClinic: jest.Mock };
  let mfaService: { verifyLoginCode: jest.Mock };
  let revokedRepo: { upsert: jest.Mock; exists: jest.Mock; delete: jest.Mock };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((data) => {
        data.id = data.id ?? 1;
        return Promise.resolve(data);
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    clinicRepo = {
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((data) => {
        data.id = data.id ?? 100;
        return Promise.resolve(data);
      }),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
      verify: jest.fn(),
    };
    ownerCodeService = {
      validate: jest.fn(),
      markAsUsed: jest.fn().mockResolvedValue(undefined),
    };
    subscriptionsService = {
      provisionTrialForNewClinic: jest.fn().mockResolvedValue(undefined),
    };
    mfaService = { verifyLoginCode: jest.fn() };
    revokedRepo = {
      upsert: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn().mockResolvedValue(false),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: getRepositoryToken(RevokedToken), useValue: revokedRepo },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'test-value') },
        },
        { provide: OwnerCodeService, useValue: ownerCodeService },
        {
          provide: ClinicSubscriptionsService,
          useValue: subscriptionsService,
        },
        { provide: MfaService, useValue: mfaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('register', () => {
    const dto = {
      email: 'new@x.com',
      password: 'Passw0rd!',
      name: 'New User',
    } as any;

    it('creates a PENDING user when no owner code is given (positive)', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.register(dto);

      expect(result.data.role).toBe(UserRole.PENDING);
      expect(result.data.isActive).toBe(false);
      expect(clinicRepo.save).not.toHaveBeenCalled();
    });

    it('creates an active OWNER + clinic with a valid owner code (positive)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      ownerCodeService.validate.mockResolvedValue(true);

      const result = await service.register({
        ...dto,
        ownerCode: 'VALIDCODE',
      });

      expect(result.data.role).toBe(UserRole.OWNER);
      expect(result.data.isActive).toBe(true);
      expect(clinicRepo.save).toHaveBeenCalled();
      expect(subscriptionsService.provisionTrialForNewClinic).toHaveBeenCalled();
      expect(ownerCodeService.markAsUsed).toHaveBeenCalledWith(
        'VALIDCODE',
        expect.any(Number),
      );
    });

    it('throws ConflictException when email already exists (negative)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, email: dto.email });
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException for an invalid owner code (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      ownerCodeService.validate.mockResolvedValue(false);

      await expect(
        service.register({ ...dto, ownerCode: 'BADCODE' }),
      ).rejects.toThrow(BadRequestException);
      expect(clinicRepo.save).not.toHaveBeenCalled();
    });

    it('does not fail registration when marking owner code used throws (negative/edge)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      ownerCodeService.validate.mockResolvedValue(true);
      ownerCodeService.markAsUsed.mockRejectedValue(new Error('boom'));

      await expect(
        service.register({ ...dto, ownerCode: 'VALIDCODE' }),
      ).resolves.toMatchObject({ success: true });
    });
  });

  describe('login', () => {
    const dto = { email: 'a@x.com', password: 'Passw0rd!' } as any;
    let activeUser: any;

    beforeEach(() => {
      activeUser = {
        id: 1,
        email: dto.email,
        passwordHash: 'hashed',
        emailVerifiedAt: new Date(),
        isActive: true,
        role: UserRole.ADMIN,
        clinicId: 1,
        practitionerId: null,
      };
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    });

    it('returns an access token for valid credentials (positive)', async () => {
      userRepo.findOne.mockResolvedValue(activeUser);

      const result = await service.login(dto);

      expect(result.data.accessToken).toBe('signed.jwt.token');
      expect(userRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      );
    });

    it('flags mfaSetupRequired for a privileged role without MFA enabled (positive/edge)', async () => {
      userRepo.findOne.mockResolvedValue({
        ...activeUser,
        role: UserRole.OWNER,
      });
      const result = await service.login(dto);
      expect(result.data.mfaSetupRequired).toBe(true);
      expect(result.data.user.mfaEnabled).toBeFalsy();
    });

    it('does not flag mfaSetupRequired for a non-enforced role (positive/edge)', async () => {
      for (const role of [UserRole.ADMIN, UserRole.DOKTER]) {
        userRepo.findOne.mockResolvedValue({ ...activeUser, role });
        const result = await service.login(dto);
        expect(result.data.mfaSetupRequired).toBe(false);
      }
    });

    it('throws UnauthorizedException when user does not exist (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password (negative)', async () => {
      userRepo.findOne.mockResolvedValue(activeUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('counts a wrong password toward the lockout (negative)', async () => {
      userRepo.findOne.mockResolvedValue({ ...activeUser, failedLoginAttempts: 1 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      expect(userRepo.update).toHaveBeenCalledWith(1, { failedLoginAttempts: 2 });
    });

    it('locks the account for 15 minutes on the 5th wrong password (negative)', async () => {
      userRepo.findOne.mockResolvedValue({ ...activeUser, failedLoginAttempts: 4 });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      const [, patch] = userRepo.update.mock.calls[0];
      expect(patch.failedLoginAttempts).toBe(0);
      expect(patch.lockedUntil.getTime()).toBeGreaterThan(Date.now() + 14 * 60_000);
    });

    it('rejects a locked account even with the right password (negative)', async () => {
      const compareCalls = (bcrypt.compare as jest.Mock).mock.calls.length;
      userRepo.findOne.mockResolvedValue({
        ...activeUser,
        lockedUntil: new Date(Date.now() + 5 * 60_000),
      });
      await expect(service.login(dto)).rejects.toMatchObject({
        response: { error: { code: 'ACCOUNT_LOCKED' } },
      });
      expect((bcrypt.compare as jest.Mock).mock.calls.length).toBe(compareCalls);
    });

    it('clears the failed-attempt counter after a successful login (positive)', async () => {
      userRepo.findOne.mockResolvedValue({ ...activeUser, failedLoginAttempts: 3 });
      await service.login(dto);
      expect(userRepo.update).toHaveBeenCalledWith(1, {
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
    });

    it('throws UnauthorizedException when email is not verified (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        ...activeUser,
        emailVerifiedAt: null,
      });
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is not active (negative)', async () => {
      userRepo.findOne.mockResolvedValue({ ...activeUser, isActive: false });
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('returns an MFA challenge instead of an access token when MFA is enabled (positive/edge)', async () => {
      userRepo.findOne.mockResolvedValue({ ...activeUser, mfaEnabled: true });

      const result = await service.login(dto);

      expect(result.data).toEqual({
        mfaRequired: true,
        mfaToken: 'signed.jwt.token',
      });
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: 1, type: 'mfa_challenge' },
        { expiresIn: '5m' },
      );
      // The real access token must not be issued yet, and last-login isn't
      // recorded until the MFA step actually completes.
      expect(userRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('verifyMfaLogin', () => {
    const mfaUser = {
      id: 1,
      email: 'a@x.com',
      name: 'A',
      role: UserRole.ADMIN,
      clinicId: 1,
      practitionerId: null,
      isActive: true,
      mfaEnabled: true,
    };

    it('issues the real access token for a valid challenge token and code (positive)', async () => {
      jwtService.verify = jest
        .fn()
        .mockReturnValue({ sub: 1, type: 'mfa_challenge' });
      mfaService.verifyLoginCode.mockResolvedValue(mfaUser);

      const result = await service.verifyMfaLogin('challenge-token', '123456');

      expect(mfaService.verifyLoginCode).toHaveBeenCalledWith(1, '123456');
      expect(result.data.accessToken).toBe('signed.jwt.token');
      expect(result.data.mfaSetupRequired).toBe(false);
      expect(result.data.user.id).toBe(1);
    });

    it('throws UnauthorizedException for an expired/invalid challenge token (negative)', async () => {
      jwtService.verify = jest.fn().mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(
        service.verifyMfaLogin('bad-token', '123456'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mfaService.verifyLoginCode).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when the token is not an MFA challenge (negative)', async () => {
      // e.g. someone tries to replay a normal access token here instead.
      jwtService.verify = jest
        .fn()
        .mockReturnValue({ sub: 1, email: 'a@x.com', role: 'admin' });

      await expect(
        service.verifyMfaLogin('normal-token', '123456'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mfaService.verifyLoginCode).not.toHaveBeenCalled();
    });

    it('propagates the code-invalid error from MfaService (negative)', async () => {
      jwtService.verify = jest
        .fn()
        .mockReturnValue({ sub: 1, type: 'mfa_challenge' });
      mfaService.verifyLoginCode.mockRejectedValue(
        new UnauthorizedException('Kode tidak valid'),
      );

      await expect(
        service.verifyMfaLogin('challenge-token', '000000'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('impersonate', () => {
    it('issues a short-lived token for an active non-super-admin target (positive)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 5,
        email: 'target@x.com',
        role: UserRole.ADMIN,
        isActive: true,
        clinicId: 1,
        practitionerId: null,
        name: 'Target',
      });

      const result = await service.impersonate(5);

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 5, imp: true }),
        { expiresIn: '1h' },
      );
      expect(result.data.user.id).toBe(5);
    });

    it('throws NotFoundException when target does not exist (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.impersonate(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when target is SUPER_ADMIN (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 2,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      });
      await expect(service.impersonate(2)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when target is inactive (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 3,
        role: UserRole.ADMIN,
        isActive: false,
      });
      await expect(service.impersonate(3)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getMe / getActivationStatus / refreshToken', () => {
    it('getMe returns profile for existing user (positive)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, email: 'a@x.com' });
      const result = await service.getMe(1);
      expect(result.data.id).toBe(1);
    });

    it('getMe throws UnauthorizedException when user missing (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getMe(999)).rejects.toThrow(UnauthorizedException);
    });

    it('getActivationStatus reports isActive/role (positive)', async () => {
      userRepo.findOne.mockResolvedValue({
        isActive: true,
        role: UserRole.ADMIN,
        clinicId: 1,
      });
      const result = await service.getActivationStatus(1);
      expect(result.data.isActive).toBe(true);
    });

    it('getActivationStatus throws when user missing (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getActivationStatus(999)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    const nowSec = () => Math.floor(Date.now() / 1000);
    const claims = (over: Record<string, unknown> = {}) =>
      ({
        sub: 1,
        jti: 'old-jti',
        tv: 0,
        at: nowSec() - 3600,
        exp: nowSec() + 3600,
        ...over,
      }) as any;
    const activeRow = {
      id: 1,
      isActive: true,
      email: 'a@x.com',
      role: UserRole.ADMIN,
      clinicId: 1,
      practitionerId: null,
      tokenVersion: 0,
    };

    it('refreshToken re-issues a token, keeps the login time, and revokes the old one (positive)', async () => {
      userRepo.findOne.mockResolvedValue(activeRow);
      const current = claims();
      const result = await service.refreshToken(current);
      expect(result.data.accessToken).toBe('signed.jwt.token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 1, at: current.at }),
      );
      expect(revokedRepo.upsert).toHaveBeenCalledWith(
        { jti: 'old-jti', expiresAt: new Date(current.exp * 1000) },
        ['jti'],
      );
    });

    it('refreshToken refuses once the session is older than 24h (negative)', async () => {
      userRepo.findOne.mockResolvedValue(activeRow);
      await expect(
        service.refreshToken(claims({ at: nowSec() - 25 * 3600 })),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refreshToken refuses impersonation tokens (negative)', async () => {
      userRepo.findOne.mockResolvedValue(activeRow);
      await expect(
        service.refreshToken(claims({ imp: true })),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refreshToken throws for inactive user (negative)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, isActive: false });
      await expect(service.refreshToken(claims())).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('refreshToken throws when user does not exist (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.refreshToken(claims({ sub: 999 }))).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyEmail', () => {
    it('activates the user for a valid token (positive)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, email: 'a@x.com' });
      const result = await service.verifyEmail('valid-token');
      expect(result.success).toBe(true);
      expect(userRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ isActive: true }),
      );
    });

    it('throws BadRequestException for an empty token (negative)', async () => {
      await expect(service.verifyEmail('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException for an unknown token (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('forgotPassword', () => {
    it('returns a generic success message when email exists (positive)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, email: 'a@x.com' });
      const result = await service.forgotPassword('a@x.com');
      expect(result.success).toBe(true);
      expect(userRepo.update).toHaveBeenCalled();
    });

    it('returns the same generic message when email does not exist (negative — no enumeration leak)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await service.forgotPassword('nobody@x.com');
      expect(result.success).toBe(true);
      expect(userRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('resets the password for a valid non-expired token (positive)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 1,
        resetPasswordToken: 'tok',
        resetPasswordExpiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.resetPassword('tok', 'NewPassw0rd!');

      expect(result.success).toBe(true);
      expect(userRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ resetPasswordToken: null, tokenVersion: 1 }),
      );
    });

    it('throws BadRequestException for an empty token (negative)', async () => {
      await expect(service.resetPassword('', 'x')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException for an unknown token (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.resetPassword('unknown', 'x'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for an expired token (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 1,
        resetPasswordToken: 'tok',
        resetPasswordExpiresAt: new Date(Date.now() - 60_000),
      });
      await expect(
        service.resetPassword('tok', 'NewPassw0rd!'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('logout / validateUser', () => {
    it('logout revokes the current token until its expiry (positive)', async () => {
      const exp = Math.floor(Date.now() / 1000) + 600;
      const result = await service.logout({ jti: 'abc', exp } as any);
      expect(result).toEqual({
        success: true,
        data: { message: 'Logged out successfully' },
      });
      expect(revokedRepo.upsert).toHaveBeenCalledWith(
        { jti: 'abc', expiresAt: new Date(exp * 1000) },
        ['jti'],
      );
    });

    it('logout of a legacy token without jti is a no-op (edge)', async () => {
      await service.logout({ exp: 123 } as any);
      expect(revokedRepo.upsert).not.toHaveBeenCalled();
    });

    it('isTokenRevoked checks the denylist (positive)', async () => {
      revokedRepo.exists.mockResolvedValue(true);
      await expect(service.isTokenRevoked('abc')).resolves.toBe(true);
      await expect(service.isTokenRevoked(undefined)).resolves.toBe(false);
    });

    it('validateUser returns the user when found (positive)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1 });
      const result = await service.validateUser(1);
      expect(result).toEqual({ id: 1 });
    });

    it('validateUser returns null when not found (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await service.validateUser(999);
      expect(result).toBeNull();
    });
  });
});
