import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { RecallIntervalsService } from '../recall-intervals.service';
import { RecallInterval } from '../entities/recall-interval.entity';

describe('RecallIntervalsService', () => {
  let service: RecallIntervalsService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecallIntervalsService,
        { provide: getRepositoryToken(RecallInterval), useValue: repo },
      ],
    }).compile();

    service = module.get<RecallIntervalsService>(RecallIntervalsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('upsert', () => {
    it('updates an existing interval for the tarif (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, intervalDays: 30 });
      await service.upsert(1, 5, { intervalDays: 90 } as any, 9);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ intervalDays: 90, updatedBy: 9 }),
      );
    });

    it('creates a new interval when none exists (positive)', async () => {
      repo.findOne.mockResolvedValue(null);
      await service.upsert(1, 5, { intervalDays: 180 } as any, 9);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ clinicId: 1, tarifId: 5, intervalDays: 180, createdBy: 9 }),
      );
    });
  });

  describe('remove', () => {
    it('deletes the interval when found (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      await service.remove(1, 5);
      expect(repo.delete).toHaveBeenCalledWith({ id: 1 });
    });

    it('throws NotFoundException when not configured (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(1, 5)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMapForClinic', () => {
    it('builds a tarifId -> intervalDays map (positive)', async () => {
      repo.find.mockResolvedValue([
        { tarifId: 1, intervalDays: 30 },
        { tarifId: 2, intervalDays: 180 },
      ]);
      const map = await service.findMapForClinic(1);
      expect(map.get(1)).toBe(30);
      expect(map.get(2)).toBe(180);
    });

    it('returns an empty map when the clinic has no intervals configured (negative/edge)', async () => {
      repo.find.mockResolvedValue([]);
      const map = await service.findMapForClinic(1);
      expect(map.size).toBe(0);
    });
  });
});
