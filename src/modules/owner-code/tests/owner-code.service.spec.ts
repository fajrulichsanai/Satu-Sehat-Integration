import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OwnerCodeService } from '../owner-code.service';
import { OwnerCode } from '../entities/owner-code.entity';

describe('OwnerCodeService', () => {
  let service: OwnerCodeService;

  const mockRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnerCodeService,
        { provide: getRepositoryToken(OwnerCode), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<OwnerCodeService>(OwnerCodeService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('rejects creating a duplicate code (negative)', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 1, code: 'ABC123' });

      await expect(service.create({ code: 'ABC123' })).rejects.toThrow(
        ConflictException,
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('creates a new owner code (positive)', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockImplementation((c) => ({
        isUsed: false,
        ...c,
      }));
      mockRepo.save.mockImplementation((c) => {
        c.id = 1;
        c.createdAt = new Date();
        return Promise.resolve(c);
      });

      const result = await service.create({ code: 'NEWCODE' });

      expect(result.success).toBe(true);
      expect(result.data.code).toBe('NEWCODE');
      expect(result.data.isUsed).toBe(false);
    });
  });

  describe('validate', () => {
    it('returns false for an empty code (negative)', async () => {
      expect(await service.validate('')).toBe(false);
      expect(await service.validate('   ')).toBe(false);
      expect(mockRepo.findOne).not.toHaveBeenCalled();
    });

    it('returns false for a code that does not exist (negative)', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      expect(await service.validate('UNKNOWN')).toBe(false);
    });

    it('returns false for a code already used (negative)', async () => {
      mockRepo.findOne.mockResolvedValue({ code: 'USED1', isUsed: true });

      expect(await service.validate('USED1')).toBe(false);
    });

    it('returns true for a valid, unused code (positive)', async () => {
      mockRepo.findOne.mockResolvedValue({ code: 'FRESH1', isUsed: false });

      expect(await service.validate('FRESH1')).toBe(true);
    });
  });

  describe('markAsUsed', () => {
    it('rejects marking a non-existent code (negative)', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.markAsUsed('MISSING', 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects marking an already-used code (negative)', async () => {
      mockRepo.findOne.mockResolvedValue({ code: 'USED1', isUsed: true });

      await expect(service.markAsUsed('USED1', 1)).rejects.toThrow(
        ConflictException,
      );
    });

    it('marks a valid code as used (positive)', async () => {
      const code = {
        code: 'FRESH1',
        isUsed: false,
        usedBy: null,
        usedAt: null,
      };
      mockRepo.findOne.mockResolvedValue(code);
      mockRepo.save.mockImplementation((c) => Promise.resolve(c));

      const result = await service.markAsUsed('FRESH1', 42);

      expect(result.success).toBe(true);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isUsed: true, usedBy: 42 }),
      );
    });
  });
});
