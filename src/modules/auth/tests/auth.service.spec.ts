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
import { Clinic } from '../../clinics/entities/clinic.entity';
import { OwnerCodeService } from '../../owner-code/owner-code.service';
import { ClinicSubscriptionsService } from '../../subscriptions/clinic-subscriptions.service';
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
  let jwtService: { sign: jest.Mock };
  let ownerCodeService: { validate: jest.Mock; markAsUsed: jest.Mock };
  let subscriptionsService: { provisionTrialForNewClinic: jest.Mock };

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
    jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
    ownerCodeService = {
      validate: jest.fn(),
      markAsUsed: jest.fn().mockResolvedValue(undefined),
    };
    subscriptionsService = {
      provisionTrialForNewClinic: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
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

    it('throws UnauthorizedException when user does not exist (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password (negative)', async () => {
      userRepo.findOne.mockResolvedValue(activeUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
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
        expect.any(Object),
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

    it('refreshToken re-issues a token for an active user (positive)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 1,
        isActive: true,
        email: 'a@x.com',
        role: UserRole.ADMIN,
        clinicId: 1,
        practitionerId: null,
      });
      const result = await service.refreshToken(1);
      expect(result.data.accessToken).toBe('signed.jwt.token');
    });

    it('refreshToken throws for inactive user (negative)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, isActive: false });
      await expect(service.refreshToken(1)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('refreshToken throws when user does not exist (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.refreshToken(999)).rejects.toThrow(
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
        expect.objectContaining({ resetPasswordToken: null }),
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
    it('logout returns a static success message (positive)', async () => {
      const result = await service.logout();
      expect(result).toEqual({
        success: true,
        data: { message: 'Logged out successfully' },
      });
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
