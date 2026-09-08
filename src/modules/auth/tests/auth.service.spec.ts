import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth.service';
import { User } from '../../users/entities/user.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { OwnerCodeService } from '../../owner-code/owner-code.service';
import { ClinicSubscriptionsService } from '../../subscriptions/clinic-subscriptions.service';
import { UserRole } from '../../../enums';
import { RegisterDto, LoginDto } from '../dto/auth.dto';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({}) },
  })),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockClinicRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn().mockReturnValue('signed-jwt-token'),
  };

  const mockConfigService = {
    get: jest.fn((key: string, def?: unknown) => def),
  };

  const mockOwnerCodeService = {
    validate: jest.fn(),
    markAsUsed: jest.fn(),
  };

  const mockClinicSubscriptionsService = {
    provisionTrialForNewClinic: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
        {
          provide: getRepositoryToken(Clinic),
          useValue: mockClinicRepository,
        },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OwnerCodeService, useValue: mockOwnerCodeService },
        {
          provide: ClinicSubscriptionsService,
          useValue: mockClinicSubscriptionsService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const dto: RegisterDto = {
      email: 'owner@clinic.com',
      password: 'SecurePass123!',
      name: 'Dr. Owner',
      ownerCode: 'VALIDCODE',
    };

    it('rejects registration when email already exists (negative)', async () => {
      mockUserRepository.findOne.mockResolvedValue({ id: 1, email: dto.email });

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(mockClinicRepository.save).not.toHaveBeenCalled();
    });

    it('rejects registration with an invalid owner code (negative)', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockOwnerCodeService.validate.mockResolvedValue(false);

      await expect(service.register(dto)).rejects.toThrow(BadRequestException);
      expect(mockClinicRepository.save).not.toHaveBeenCalled();
    });

    it('creates an OWNER + clinic when a valid owner code is provided (positive)', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      mockOwnerCodeService.validate.mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockClinicRepository.create.mockImplementation((c) => c);
      mockClinicRepository.save.mockResolvedValue({ id: 10, ...dto });
      mockUserRepository.create.mockImplementation((u) => u);
      mockUserRepository.save.mockImplementation((u) => {
        u.id = 100;
        return Promise.resolve(u);
      });

      const result = await service.register(dto);

      expect(mockClinicRepository.save).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.OWNER,
          isActive: true,
          clinicId: 10,
        }),
      );
      expect(
        mockClinicSubscriptionsService.provisionTrialForNewClinic,
      ).toHaveBeenCalledWith(10, 100);
      expect(mockOwnerCodeService.markAsUsed).toHaveBeenCalledWith(
        dto.ownerCode,
        100,
      );
      expect(result.success).toBe(true);
      expect(result.data.role).toBe(UserRole.OWNER);
    });

    it('creates a PENDING user without a clinic when no owner code is given (positive)', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockUserRepository.create.mockImplementation((u) => u);
      mockUserRepository.save.mockImplementation((u) =>
        Promise.resolve({ id: 101, ...u }),
      );

      const result = await service.register({ ...dto, ownerCode: undefined });

      expect(mockClinicRepository.save).not.toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.PENDING,
          isActive: false,
          clinicId: null,
        }),
      );
      expect(
        mockClinicSubscriptionsService.provisionTrialForNewClinic,
      ).not.toHaveBeenCalled();
      expect(result.data.role).toBe(UserRole.PENDING);
    });

    it('still succeeds even if the verification email fails to send (positive/resilience)', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      mockUserRepository.create.mockImplementation((u) => u);
      mockUserRepository.save.mockImplementation((u) =>
        Promise.resolve({ id: 102, ...u }),
      );
      jest
        .spyOn(service, 'sendVerificationEmail')
        .mockRejectedValue(new Error('resend down'));

      const result = await service.register({ ...dto, ownerCode: undefined });

      expect(result.success).toBe(true);
    });
  });

  describe('login', () => {
    const dto: LoginDto = {
      email: 'user@clinic.com',
      password: 'SecurePass123!',
    };
    const baseUser = {
      id: 1,
      email: dto.email,
      passwordHash: 'hashed',
      emailVerifiedAt: new Date(),
      isActive: true,
      role: UserRole.OWNER,
      clinicId: 5,
      practitionerId: null,
    };

    it('rejects login for a non-existent user (negative)', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects login with a wrong password (negative)', async () => {
      mockUserRepository.findOne.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects login when the email is not verified (negative)', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...baseUser,
        emailVerifiedAt: null,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects login when the user is not active (negative)', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...baseUser,
        isActive: false,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('returns an access token for valid credentials (positive)', async () => {
      mockUserRepository.findOne.mockResolvedValue(baseUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.login(dto);

      expect(result.success).toBe(true);
      expect(result.data.accessToken).toBe('signed-jwt-token');
      expect(result.data.user.email).toBe(dto.email);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        baseUser.id,
        expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      );
    });
  });

  describe('verifyEmail', () => {
    it('rejects an empty token (negative)', async () => {
      await expect(service.verifyEmail('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an unknown token (negative)', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('activates the user for a valid token (positive)', async () => {
      mockUserRepository.findOne.mockResolvedValue({ id: 1 });
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.verifyEmail('good-token');

      expect(result.success).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ isActive: true }),
      );
    });
  });

  describe('resetPassword', () => {
    it('rejects an empty token (negative)', async () => {
      await expect(service.resetPassword('', 'NewPass123!')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects an unknown token (negative)', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword('bad-token', 'NewPass123!'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an expired token (negative)', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        id: 1,
        resetPasswordExpiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword('expired-token', 'NewPass123!'),
      ).rejects.toThrow(BadRequestException);
    });

    it('resets the password for a valid, unexpired token (positive)', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        id: 1,
        resetPasswordExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('new-hashed-password');
      mockUserRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.resetPassword('good-token', 'NewPass123!');

      expect(result.success).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ passwordHash: 'new-hashed-password' }),
      );
    });
  });

  describe('impersonate', () => {
    it('rejects impersonating a non-existent user (negative)', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.impersonate(999)).rejects.toThrow(NotFoundException);
    });

    it('rejects impersonating another super admin (negative)', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        id: 2,
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      });

      await expect(service.impersonate(2)).rejects.toThrow(BadRequestException);
    });

    it('rejects impersonating an inactive user (negative)', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        id: 3,
        role: UserRole.OWNER,
        isActive: false,
      });

      await expect(service.impersonate(3)).rejects.toThrow(BadRequestException);
    });

    it('issues a short-lived token for a valid target user (positive)', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        id: 4,
        role: UserRole.OWNER,
        isActive: true,
        email: 'target@clinic.com',
      });

      const result = await service.impersonate(4);

      expect(result.success).toBe(true);
      expect(mockJwtService.sign).toHaveBeenCalledWith(expect.anything(), {
        expiresIn: '1h',
      });
    });
  });
});
