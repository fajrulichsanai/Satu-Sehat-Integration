import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { SubscriptionPlansService } from '../subscription-plans.service';
import {
  SubscriptionPlan,
  SubscriptionPlanTier,
} from '../entities/subscription-plan.entity';

describe('SubscriptionPlansService', () => {
  let service: SubscriptionPlansService;
  let repo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionPlansService,
        { provide: getRepositoryToken(SubscriptionPlan), useValue: repo },
      ],
    }).compile();

    service = module.get<SubscriptionPlansService>(SubscriptionPlansService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findOne', () => {
    it('returns the plan when found (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      const result = await service.findOne(1);
      expect(result).toEqual({ id: 1 });
    });

    it('throws NotFoundException when missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a plan with createdBy stamped (positive)', async () => {
      const result = await service.create({ name: 'Starter' } as any, 9);
      expect(result.createdBy).toBe(9);
    });
  });

  describe('update', () => {
    it('merges fields into the existing plan (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, name: 'Old' });
      const result = await service.update(1, { name: 'New' } as any, 9);
      expect(result.name).toBe('New');
      expect(result.updatedBy).toBe(9);
    });

    it('throws NotFoundException when missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.update(999, {} as any, 9),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting isActive=false (positive)', async () => {
      const plan = { id: 1, isActive: true };
      repo.findOne.mockResolvedValue(plan);
      await service.remove(1);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('throws NotFoundException when missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findActiveTrialPlan', () => {
    it('queries for the active TRIAL-tier plan (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, tier: SubscriptionPlanTier.TRIAL });
      const result = await service.findActiveTrialPlan();
      expect(result?.tier).toBe(SubscriptionPlanTier.TRIAL);
      expect(repo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tier: SubscriptionPlanTier.TRIAL, isActive: true },
        }),
      );
    });

    it('returns null when no active trial plan is configured (negative/edge)', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.findActiveTrialPlan();
      expect(result).toBeNull();
    });
  });
});
