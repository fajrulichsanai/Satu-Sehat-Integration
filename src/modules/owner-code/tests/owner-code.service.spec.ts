import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OwnerCodeService } from '../owner-code.service';
import { OwnerCode } from '../entities/owner-code.entity';

describe('OwnerCodeService', () => {
  let service: OwnerCodeService;
  let repo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, isUsed: false, createdAt: new Date(), ...data })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnerCodeService,
        { provide: getRepositoryToken(OwnerCode), useValue: repo },
      ],
    }).compile();

    service = module.get<OwnerCodeService>(OwnerCodeService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('create', () => {
    it('creates a new owner code (positive)', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.create({ code: 'ABC123' } as any);
      expect(result.data.code).toBe('ABC123');
    });

    it('throws ConflictException for a duplicate code (negative)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, code: 'ABC123' });
      await expect(
        service.create({ code: 'ABC123' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('returns all codes ordered by newest first (positive)', async () => {
      repo.find.mockResolvedValue([{ id: 1 }]);
      const result = await service.findAll();
      expect(result.data).toHaveLength(1);
      expect(repo.find).toHaveBeenCalledWith({ order: { createdAt: 'DESC' } });
    });
  });

  describe('validate', () => {
    it('returns true for an unused existing code (positive)', async () => {
      repo.findOne.mockResolvedValue({ code: 'ABC123', isUsed: false });
      await expect(service.validate('ABC123')).resolves.toBe(true);
    });

    it('returns false for an already-used code (negative)', async () => {
      repo.findOne.mockResolvedValue({ code: 'ABC123', isUsed: true });
      await expect(service.validate('ABC123')).resolves.toBe(false);
    });

    it('returns false for a non-existent code (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.validate('UNKNOWN')).resolves.toBe(false);
    });

    it('returns false for an empty string without querying the repo (negative/edge)', async () => {
      await expect(service.validate('')).resolves.toBe(false);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('returns false for a whitespace-only string (negative/edge)', async () => {
      await expect(service.validate('   ')).resolves.toBe(false);
    });
  });

  describe('markAsUsed', () => {
    it('marks an unused code as used (positive)', async () => {
      const code = { id: 1, code: 'ABC123', isUsed: false };
      repo.findOne.mockResolvedValue(code);

      await service.markAsUsed('ABC123', 9);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isUsed: true, usedBy: 9 }),
      );
    });

    it('throws NotFoundException for an unknown code (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.markAsUsed('UNKNOWN', 9)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when the code is already used (negative)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, code: 'ABC123', isUsed: true });
      await expect(service.markAsUsed('ABC123', 9)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
