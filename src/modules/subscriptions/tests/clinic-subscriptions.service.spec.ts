import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ClinicSubscriptionsService } from '../clinic-subscriptions.service';
import {
  ClinicSubscription,
  ClinicSubscriptionStatus,
} from '../entities/clinic-subscription.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { SubscriptionPlansService } from '../subscription-plans.service';

function buildQb(result: any[] = []) {
  return {
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
  };
}

function daysFromToday(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('ClinicSubscriptionsService', () => {
  let service: ClinicSubscriptionsService;
  let subRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let clinicRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let plansService: { findOne: jest.Mock; findActiveTrialPlan: jest.Mock };

  beforeEach(async () => {
    subRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      createQueryBuilder: jest.fn(() => buildQb()),
    };
    clinicRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => buildQb()),
    };
    plansService = { findOne: jest.fn(), findActiveTrialPlan: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicSubscriptionsService,
        { provide: getRepositoryToken(ClinicSubscription), useValue: subRepo },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: SubscriptionPlansService, useValue: plansService },
      ],
    }).compile();

    service = module.get<ClinicSubscriptionsService>(
      ClinicSubscriptionsService,
    );
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('extendSubscription', () => {
    it('starts a fresh subscription from today when there is no current one (positive)', async () => {
      clinicRepo.findOne.mockResolvedValue({ id: 1, name: 'Klinik A' });
      plansService.findOne.mockResolvedValue({ id: 5, durationDays: 30 });
      subRepo.findOne
        .mockResolvedValueOnce(null) // getCurrentForClinic
        .mockResolvedValueOnce({ id: 10, plan: { id: 5 } }); // re-fetch with plan

      const result = await service.extendSubscription(1, 5, 9);

      expect(subRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: daysFromToday(0),
          endDate: daysFromToday(30),
          status: ClinicSubscriptionStatus.ACTIVE,
        }),
      );
      expect(result.id).toBe(10);
    });

    it('stacks the new duration on top of a still-active current subscription (positive)', async () => {
      clinicRepo.findOne.mockResolvedValue({ id: 1, name: 'Klinik A' });
      plansService.findOne.mockResolvedValue({ id: 5, durationDays: 30 });
      subRepo.findOne
        .mockResolvedValueOnce({
          id: 9,
          status: ClinicSubscriptionStatus.ACTIVE,
          endDate: daysFromToday(10),
        })
        .mockResolvedValueOnce({ id: 11 });

      await service.extendSubscription(1, 5, 9);

      expect(subRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: daysFromToday(10),
          endDate: daysFromToday(40),
        }),
      );
    });

    it('starts from today (not stacking) when the current subscription already expired (positive/edge)', async () => {
      clinicRepo.findOne.mockResolvedValue({ id: 1, name: 'Klinik A' });
      plansService.findOne.mockResolvedValue({ id: 5, durationDays: 30 });
      subRepo.findOne
        .mockResolvedValueOnce({
          id: 9,
          status: ClinicSubscriptionStatus.EXPIRED,
          endDate: daysFromToday(-5),
        })
        .mockResolvedValueOnce({ id: 12 });

      await service.extendSubscription(1, 5, 9);

      expect(subRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: daysFromToday(0) }),
      );
    });

    it('throws NotFoundException when the clinic does not exist (negative)', async () => {
      clinicRepo.findOne.mockResolvedValue(null);
      await expect(service.extendSubscription(999, 5, 9)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('provisionTrialForNewClinic', () => {
    it('enrolls the clinic in the active trial plan (positive)', async () => {
      plansService.findActiveTrialPlan.mockResolvedValue({
        id: 1,
        durationDays: 15,
      });
      clinicRepo.findOne.mockResolvedValue({ id: 1 });
      plansService.findOne.mockResolvedValue({ id: 1, durationDays: 15 });
      subRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 20 });

      const result = await service.provisionTrialForNewClinic(1, 9);

      expect(result?.id).toBe(20);
    });

    it('returns null without throwing when there is no active trial plan configured (negative/edge)', async () => {
      plansService.findActiveTrialPlan.mockResolvedValue(null);
      const result = await service.provisionTrialForNewClinic(1, 9);
      expect(result).toBeNull();
    });

    it('swallows any error and returns null instead of blocking registration (negative/edge)', async () => {
      plansService.findActiveTrialPlan.mockRejectedValue(new Error('db down'));
      const result = await service.provisionTrialForNewClinic(1, 9);
      expect(result).toBeNull();
    });
  });

  describe('listAll', () => {
    it('attaches each clinic’s latest subscription and paginates (positive)', async () => {
      const clinicsQb = buildQb([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ]);
      clinicRepo.createQueryBuilder.mockReturnValue(clinicsQb);
      subRepo.find.mockResolvedValue([
        { clinicId: 1, id: 100, status: ClinicSubscriptionStatus.ACTIVE },
      ]);

      const result = await service.listAll({ page: 1, limit: 10 } as any);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].subscription?.id).toBe(100);
      expect(result.data[1].subscription).toBeNull();
    });

    it('filters clinics by subscription status after joining (positive)', async () => {
      const clinicsQb = buildQb([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ]);
      clinicRepo.createQueryBuilder.mockReturnValue(clinicsQb);
      subRepo.find.mockResolvedValue([
        { clinicId: 1, id: 100, status: ClinicSubscriptionStatus.ACTIVE },
      ]);

      const result = await service.listAll({
        page: 1,
        limit: 10,
        status: ClinicSubscriptionStatus.ACTIVE,
      } as any);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].clinicId).toBe(1);
    });

    it('returns an empty page (not an error) with no clinics matching the search (negative/edge)', async () => {
      clinicRepo.createQueryBuilder.mockReturnValue(buildQb([]));
      const result = await service.listAll({
        page: 1,
        limit: 10,
        search: 'nonexistent',
      } as any);
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('expireLapsedSubscriptions', () => {
    it('returns the number of rows flipped to EXPIRED (positive)', async () => {
      const qb = buildQb();
      qb.execute.mockResolvedValue({ affected: 3 });
      subRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.expireLapsedSubscriptions();

      expect(result).toBe(3);
    });

    it('returns 0 when nothing has lapsed (negative/edge)', async () => {
      const qb = buildQb();
      qb.execute.mockResolvedValue({ affected: undefined });
      subRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.expireLapsedSubscriptions();

      expect(result).toBe(0);
    });
  });
});
