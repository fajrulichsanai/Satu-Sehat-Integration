import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SubscriptionPaymentsService } from '../subscription-payments.service';
import {
  SubscriptionPayment,
  SubscriptionPaymentStatus,
} from '../entities/subscription-payment.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { User } from '../../users/entities/user.entity';
import { SubscriptionPlansService } from '../subscription-plans.service';
import { ClinicSubscriptionsService } from '../clinic-subscriptions.service';
import { SubscriptionPlanTier } from '../entities/subscription-plan.entity';

function buildQb(result: [any[], number] = [[], 0]) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
  };
}

describe('SubscriptionPaymentsService', () => {
  let service: SubscriptionPaymentsService;
  let paymentRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let clinicRepo: { find: jest.Mock };
  let userRepo: { find: jest.Mock };
  let plansService: { findOne: jest.Mock };
  let clinicSubsService: { extendSubscription: jest.Mock };

  beforeEach(async () => {
    paymentRepo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };
    clinicRepo = { find: jest.fn().mockResolvedValue([]) };
    userRepo = { find: jest.fn().mockResolvedValue([]) };
    plansService = { findOne: jest.fn() };
    clinicSubsService = { extendSubscription: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionPaymentsService,
        { provide: getRepositoryToken(SubscriptionPayment), useValue: paymentRepo },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: SubscriptionPlansService, useValue: plansService },
        { provide: ClinicSubscriptionsService, useValue: clinicSubsService },
      ],
    }).compile();

    service = module.get<SubscriptionPaymentsService>(
      SubscriptionPaymentsService,
    );
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('claim', () => {
    it('computes amount as price + ownerFee for a single-clinic plan (positive)', async () => {
      plansService.findOne.mockResolvedValue({
        id: 1,
        tier: SubscriptionPlanTier.PRO,
        price: 500000,
        ownerFee: 50000,
      });

      const result = await service.claim(
        1,
        { planId: 1, quantity: 5 } as any,
        9,
      );

      // quantity should be ignored/forced to 1 for a non-MULTI_KLINIK plan
      expect(result.quantity).toBe(1);
      expect(result.amount).toBe(550000);
    });

    it('multiplies price by quantity for a MULTI_KLINIK plan (positive)', async () => {
      plansService.findOne.mockResolvedValue({
        id: 2,
        tier: SubscriptionPlanTier.MULTI_KLINIK,
        price: 200000,
        ownerFee: 0,
      });

      const result = await service.claim(
        1,
        { planId: 2, quantity: 3 } as any,
        9,
      );

      expect(result.quantity).toBe(3);
      expect(result.amount).toBe(600000);
    });

    it('defaults MULTI_KLINIK quantity to at least 1 even if 0 or omitted (edge)', async () => {
      plansService.findOne.mockResolvedValue({
        id: 2,
        tier: SubscriptionPlanTier.MULTI_KLINIK,
        price: 200000,
        ownerFee: 0,
      });

      const result = await service.claim(
        1,
        { planId: 2, quantity: 0 } as any,
        9,
      );

      expect(result.quantity).toBe(1);
    });

    it('attaches the proof URL when a file is uploaded (positive)', async () => {
      plansService.findOne.mockResolvedValue({
        id: 1,
        tier: SubscriptionPlanTier.PRO,
        price: 100000,
        ownerFee: 0,
      });

      const result = await service.claim(
        1,
        { planId: 1 } as any,
        9,
        { filename: 'proof-123.jpg' } as any,
      );

      expect(result.proofUrl).toBe('/uploads/payment-proofs/proof-123.jpg');
    });

    it('sets proofUrl to null when no file is uploaded (negative/edge)', async () => {
      plansService.findOne.mockResolvedValue({
        id: 1,
        tier: SubscriptionPlanTier.PRO,
        price: 100000,
        ownerFee: 0,
      });

      const result = await service.claim(1, { planId: 1 } as any, 9);

      expect(result.proofUrl).toBeNull();
    });

    it('propagates NotFoundException when the plan does not exist (negative)', async () => {
      plansService.findOne.mockRejectedValue(new NotFoundException());
      await expect(
        service.claim(1, { planId: 999 } as any, 9),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('claimForOwner', () => {
    it('derives quantity from linkedClinicIds and multiplies price by it (positive)', async () => {
      plansService.findOne.mockResolvedValue({
        id: 2,
        tier: SubscriptionPlanTier.MULTI_KLINIK,
        price: 200000,
        ownerFee: 50000,
      });

      const result = await service.claimForOwner(
        7,
        [10, 11, 12],
        { planId: 2 } as any,
        7,
      );

      expect(result.quantity).toBe(3);
      expect(result.amount).toBe(650000);
      expect(result.ownerId).toBe(7);
      expect(result.clinicId).toBeNull();
      expect(result.coveredClinicIds).toEqual([10, 11, 12]);
    });

    it('throws BadRequestException when the owner has no linked clinics (negative)', async () => {
      await expect(
        service.claimForOwner(7, [], { planId: 2 } as any, 7),
      ).rejects.toThrow(BadRequestException);
      expect(plansService.findOne).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the plan is not the MULTI_KLINIK tier (negative)', async () => {
      plansService.findOne.mockResolvedValue({
        id: 1,
        tier: SubscriptionPlanTier.PRO,
        price: 500000,
        ownerFee: 0,
      });

      await expect(
        service.claimForOwner(7, [10], { planId: 1 } as any, 7),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listMine / listQueue', () => {
    it('scopes listMine to the calling clinic (positive)', async () => {
      const qb = buildQb();
      paymentRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listMine(1, {} as any);

      expect(qb.andWhere).toHaveBeenCalledWith('p.clinicId = :clinicId', {
        clinicId: 1,
      });
    });

    it('listQueue attaches clinicName from a batched lookup (positive)', async () => {
      const qb = buildQb([[{ id: 1, clinicId: 5 }], 1]);
      paymentRepo.createQueryBuilder.mockReturnValue(qb);
      clinicRepo.find.mockResolvedValue([{ id: 5, name: 'Klinik A' }]);

      const result = await service.listQueue({} as any);

      expect(result.data[0].clinicName).toBe('Klinik A');
    });

    it('listQueue skips the clinic lookup entirely when there are no payments (edge)', async () => {
      paymentRepo.createQueryBuilder.mockReturnValue(buildQb([[], 0]));
      await service.listQueue({} as any);
      expect(clinicRepo.find).not.toHaveBeenCalled();
      expect(userRepo.find).not.toHaveBeenCalled();
    });

    it('listQueue attaches ownerName from a batched user lookup for owner-scoped rows (positive)', async () => {
      const qb = buildQb([
        [{ id: 1, clinicId: null, ownerId: 7 }],
        1,
      ]);
      paymentRepo.createQueryBuilder.mockReturnValue(qb);
      userRepo.find.mockResolvedValue([{ id: 7, name: 'Budi Owner' }]);

      const result = await service.listQueue({} as any);

      expect(result.data[0].ownerName).toBe('Budi Owner');
      expect(result.data[0].clinicName).toBeUndefined();
      expect(clinicRepo.find).not.toHaveBeenCalled();
    });

    it('listMineForOwner scopes the query to the calling owner (positive)', async () => {
      const qb = buildQb();
      paymentRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listMineForOwner(7, {} as any);

      expect(qb.where).toHaveBeenCalledWith('p.ownerId = :ownerId', {
        ownerId: 7,
      });
    });
  });

  describe('confirm', () => {
    it('extends the subscription and marks the payment CONFIRMED (positive)', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        planId: 2,
        status: SubscriptionPaymentStatus.PENDING,
      });
      clinicSubsService.extendSubscription.mockResolvedValue({ id: 99 });

      const result = await service.confirm(1, {} as any, 5);

      expect(result.status).toBe(SubscriptionPaymentStatus.CONFIRMED);
      expect(result.subscriptionId).toBe(99);
    });

    it('throws NotFoundException when the payment does not exist (negative)', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      await expect(service.confirm(999, {} as any, 5)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when the payment was already reviewed (negative)', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 1,
        status: SubscriptionPaymentStatus.CONFIRMED,
      });
      await expect(service.confirm(1, {} as any, 5)).rejects.toThrow(
        BadRequestException,
      );
      expect(clinicSubsService.extendSubscription).not.toHaveBeenCalled();
    });

    it('extends every coveredClinicIds entry for an owner-scoped payment (positive)', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: null,
        ownerId: 7,
        planId: 2,
        coveredClinicIds: [10, 11, 12],
        status: SubscriptionPaymentStatus.PENDING,
      });
      clinicSubsService.extendSubscription
        .mockResolvedValueOnce({ id: 201 })
        .mockResolvedValueOnce({ id: 202 })
        .mockResolvedValueOnce({ id: 203 });

      const result = await service.confirm(1, {} as any, 5);

      expect(clinicSubsService.extendSubscription).toHaveBeenCalledTimes(3);
      expect(clinicSubsService.extendSubscription).toHaveBeenNthCalledWith(
        1,
        10,
        2,
        5,
        undefined,
      );
      expect(clinicSubsService.extendSubscription).toHaveBeenNthCalledWith(
        2,
        11,
        2,
        5,
        undefined,
      );
      expect(clinicSubsService.extendSubscription).toHaveBeenNthCalledWith(
        3,
        12,
        2,
        5,
        undefined,
      );
      expect(result.status).toBe(SubscriptionPaymentStatus.CONFIRMED);
      // Only the first extended clinic's subscription id is stored — the
      // payment row itself has a single subscriptionId column.
      expect(result.subscriptionId).toBe(201);
    });
  });

  describe('reject', () => {
    it('marks a pending payment as REJECTED without touching subscriptions (positive)', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 1,
        status: SubscriptionPaymentStatus.PENDING,
      });

      const result = await service.reject(1, { notes: 'Bukti tidak valid' } as any, 5);

      expect(result.status).toBe(SubscriptionPaymentStatus.REJECTED);
      expect(result.notes).toBe('Bukti tidak valid');
      expect(clinicSubsService.extendSubscription).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the payment was already reviewed (negative)', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 1,
        status: SubscriptionPaymentStatus.REJECTED,
      });
      await expect(service.reject(1, {} as any, 5)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
