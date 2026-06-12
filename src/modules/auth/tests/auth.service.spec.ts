import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { User } from '../../../entities/user.entity';
import { Clinic } from '../../../entities/clinic.entity';

const mockUserRepo = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};
const mockClinicRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
const mockJwt = { sign: jest.fn().mockReturnValue('mock-token') };

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Clinic), useValue: mockClinicRepo },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();
    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if email already exists', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 1, email: 'test@test.com' });
      await expect(service.register({ email: 'test@test.com', password: 'pass', name: 'Test', role: 'admin' as any }))
        .rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for invalid credentials', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.login({ email: 'bad@email.com', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('verifyEmail', () => {
    it('should throw BadRequestException if token is empty', async () => {
      await expect(service.verifyEmail('')).rejects.toThrow();
    });
  });

  describe('validateUser', () => {
    it('should return null for non-existent user', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const result = await service.validateUser(999);
      expect(result).toBeNull();
    });

    it('should return user if found', async () => {
      const user = { id: 1, email: 'user@test.com' };
      mockUserRepo.findOne.mockResolvedValue(user);
      const result = await service.validateUser(1);
      expect(result).toEqual(user);
    });
  });
});
