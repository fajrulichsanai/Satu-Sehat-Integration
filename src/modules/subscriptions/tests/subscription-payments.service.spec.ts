import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

import { existsSync } from 'fs';
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
import { OwnerClinicLink } from '../../multi-clinic/entities/owner-clinic-link.entity';
import { SubscriptionNotificationsService } from '../subscription-notifications.service';
import { StorageQuotaService } from '../../storage-quota/storage-quota.service';

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
  let clinicSubsService: {
    extendSubscription: jest.Mock;
    getInEffectForClinic: jest.Mock;
    paidUntil: jest.Mock;
    applyUpgrade: jest.Mock;
  };
  let linkRepo: { findOne: jest.Mock };
  let notifications: { sendPaymentReceipt: jest.Mock };
  let storageQuota: {
    extraGbToBillForClinic: jest.Mock;
    billableExtraGb: jest.Mock;
  };

  beforeEach(async () => {
    paymentRepo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };
    clinicRepo = {
      find: jest.fn().mockResolvedValue([]),
      manager: { query: jest.fn().mockResolvedValue([{ n: 3 }]) },
    } as any;
    userRepo = { find: jest.fn().mockResolvedValue([]) };
    plansService = { findOne: jest.fn() };
    clinicSubsService = {
      extendSubscription: jest.fn(),
      getInEffectForClinic: jest.fn().mockResolvedValue(null),
      paidUntil: jest.fn().mockResolvedValue(null),
      applyUpgrade: jest.fn(),
    };
    linkRepo = { findOne: jest.fn().mockResolvedValue(null) };
    notifications = { sendPaymentReceipt: jest.fn().mockResolvedValue(true) };
    storageQuota = {
      extraGbToBillForClinic: jest.fn().mockResolvedValue(0),
      billableExtraGb: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionPaymentsService,
        {
          provide: getRepositoryToken(SubscriptionPayment),
          useValue: paymentRepo,
        },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: SubscriptionPlansService, useValue: plansService },
        { provide: ClinicSubscriptionsService, useValue: clinicSubsService },
        { provide: getRepositoryToken(OwnerClinicLink), useValue: linkRepo },
        { provide: SubscriptionNotificationsService, useValue: notifications },
        { provide: StorageQuotaService, useValue: storageQuota },
      ],
    }).compile();

    service = module.get<SubscriptionPaymentsService>(
      SubscriptionPaymentsService,
    );
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('claim', () => {
    it('adds storage tambahan to the same bill: Rp10.000/GB/bulan, 10× for yearly (positive)', async () => {
      storageQuota.extraGbToBillForClinic.mockResolvedValue(3);
      plansService.findOne.mockResolvedValue({
        id: 1,
        tier: SubscriptionPlanTier.BASIC,
        price: 99000,
        ownerFee: 0,
        billingCycle: 'monthly',
      });
      let result = await service.claim(1, { planId: 1 }, 9);
      expect(result).toMatchObject({
        extraStorageGb: 3,
        storageAmount: 30000,
        amount: 129000,
      });

      plansService.findOne.mockResolvedValue({
        id: 2,
        tier: SubscriptionPlanTier.BASIC,
        price: 990000,
        ownerFee: 0,
        billingCycle: 'yearly',
      });
      result = await service.claim(1, { planId: 2 }, 9);
      expect(result).toMatchObject({
        extraStorageGb: 3,
        storageAmount: 300000,
        amount: 1290000,
      });
    });

    it('applies promo price and duration discount for a 6-month claim (positive)', async () => {
      storageQuota.extraGbToBillForClinic.mockResolvedValue(1);
      plansService.findOne.mockResolvedValue({
        id: 1,
        tier: SubscriptionPlanTier.BASIC,
        price: 199000,
        promoPrice: 99000,
        promoUntil: '2999-12-31',
        ownerFee: 0,
        billingCycle: 'monthly',
      });
      const result = await service.claim(1, { planId: 1, months: 6 }, 9);
      // 99.000 × 6 = 594.000; −10% = 534.600; + storage 1 GB × 6 = 60.000
      expect(result).toMatchObject({
        months: 6,
        promoDiscount: 600000,
        durationDiscount: 59400,
        storageAmount: 60000,
        amount: 594600,
      });
    });

    it('bills the multiklinik pool add-ons to the owner (positive)', async () => {
      storageQuota.billableExtraGb.mockResolvedValue(2);
      plansService.findOne.mockResolvedValue({
        id: 3,
        tier: SubscriptionPlanTier.MULTI_KLINIK,
        price: 124000,
        ownerFee: 50000,
        billingCycle: 'monthly',
      });
      const result = await service.claimForOwner(
        5,
        [10, 11],
        { planId: 3 } as any,
        5,
      );
      expect(storageQuota.billableExtraGb).toHaveBeenCalledWith({ ownerId: 5 });
      expect(result).toMatchObject({
        quantity: 2,
        extraStorageGb: 2,
        storageAmount: 20000,
        amount: 318000,
      });
    });

    it('charges a self-paying multiklinik branch one branch, no owner fee (positive)', async () => {
      plansService.findOne.mockResolvedValue({
        id: 2,
        tier: SubscriptionPlanTier.MULTI_KLINIK,
        price: 124000,
        ownerFee: 50000,
      });
      linkRepo.findOne.mockResolvedValue({ id: 1, billingMode: 'self' });

      const result = await service.claim(1, { planId: 2, quantity: 4 }, 9);

      expect(linkRepo.findOne).toHaveBeenCalledWith({
        where: { clinicId: 1, status: 'approved', billingMode: 'self' },
      });
      expect(result.quantity).toBe(1);
      expect(result.amount).toBe(124000);
    });

    it('computes amount as price + ownerFee for a single-clinic plan (positive)', async () => {
      plansService.findOne.mockResolvedValue({
        id: 1,
        tier: SubscriptionPlanTier.PRO,
        price: 500000,
        ownerFee: 50000,
      });

      const result = await service.claim(1, { planId: 1, quantity: 5 }, 9);

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

      const result = await service.claim(1, { planId: 2, quantity: 3 }, 9);

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

      const result = await service.claim(1, { planId: 2, quantity: 0 }, 9);

      expect(result.quantity).toBe(1);
    });

    it('attaches the proof URL when a file is uploaded (positive)', async () => {
      plansService.findOne.mockResolvedValue({
        id: 1,
        tier: SubscriptionPlanTier.PRO,
        price: 100000,
        ownerFee: 0,
      });

      const result = await service.claim(1, { planId: 1 }, 9, {
        filename: 'proof-123.jpg',
      } as any);

      expect(result.proofUrl).toBe('/subscription-payments/1/proof-file');
    });

    it('sets proofUrl to null when no file is uploaded (negative/edge)', async () => {
      plansService.findOne.mockResolvedValue({
        id: 1,
        tier: SubscriptionPlanTier.PRO,
        price: 100000,
        ownerFee: 0,
      });

      const result = await service.claim(1, { planId: 1 }, 9);

      expect(result.proofUrl).toBeNull();
    });

    it('propagates NotFoundException when the plan does not exist (negative)', async () => {
      plansService.findOne.mockRejectedValue(new NotFoundException());
      await expect(service.claim(1, { planId: 999 } as any, 9)).rejects.toThrow(
        NotFoundException,
      );
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
      const qb = buildQb([[{ id: 1, clinicId: null, ownerId: 7 }], 1]);
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

  describe('getProofFilePath', () => {
    it('resolves the path for the owning clinic (positive)', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 5,
        proofUrl: '/uploads/payment-proofs/proof-123.jpg',
      });
      (existsSync as jest.Mock).mockReturnValue(true);

      const result = await service.getProofFilePath(1, 5);

      expect(result).toContain('uploads/payment-proofs/proof-123.jpg');
    });

    it('allows a SUPER_ADMIN (null clinicId) to view any clinic proof (positive)', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 5,
        proofUrl: '/uploads/payment-proofs/proof-123.jpg',
      });
      (existsSync as jest.Mock).mockReturnValue(true);

      await expect(service.getProofFilePath(1, null)).resolves.toBeDefined();
    });

    it('throws NotFoundException when another clinic requests the proof (negative)', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 5,
        proofUrl: '/uploads/payment-proofs/proof-123.jpg',
      });

      await expect(service.getProofFilePath(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lets a multi-klinik owner open only their own combined payment proof (security)', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: null,
        ownerId: 5,
        proofUrl: '/uploads/payment-proofs/proof-9.jpg',
      });
      (existsSync as jest.Mock).mockReturnValue(true);

      await expect(service.getOwnerProofFilePath(1, 5)).resolves.toContain(
        'proof-9.jpg',
      );
      await expect(service.getOwnerProofFilePath(1, 6)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the payment has no proof (negative)', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 5,
        proofUrl: null,
      });

      await expect(service.getProofFilePath(1, 5)).rejects.toThrow(
        NotFoundException,
      );
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

      const result = await service.confirm(1, {}, 5);

      expect(result.status).toBe(SubscriptionPaymentStatus.CONFIRMED);
      expect(result.subscriptionId).toBe(99);
    });

    it('sends the payer a receipt after confirming (positive)', async () => {
      paymentRepo.findOne.mockResolvedValue({
        id: 7,
        ownerId: 5,
        clinicId: null,
        coveredClinicIds: [10, 11],
        planId: 2,
        status: SubscriptionPaymentStatus.PENDING,
      });
      clinicSubsService.extendSubscription.mockResolvedValue({ id: 99 });

      await service.confirm(7, {}, 1);
      // The receipt (with its PDF) is sent after the confirm resolves.
      await new Promise((r) => setImmediate(r));

      expect(clinicSubsService.extendSubscription).toHaveBeenCalledTimes(2);
      expect(notifications.sendPaymentReceipt.mock.calls[0][0]).toMatchObject({
        id: 7,
        status: SubscriptionPaymentStatus.CONFIRMED,
      });
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
        1,
      );
      expect(clinicSubsService.extendSubscription).toHaveBeenNthCalledWith(
        2,
        11,
        2,
        5,
        undefined,
        1,
      );
      expect(clinicSubsService.extendSubscription).toHaveBeenNthCalledWith(
        3,
        12,
        2,
        5,
        undefined,
        1,
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

      const result = await service.reject(1, { notes: 'Bukti tidak valid' }, 5);

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

  describe('receipt', () => {
    const confirmed = {
      id: 7,
      clinicId: 3,
      ownerId: null,
      status: SubscriptionPaymentStatus.CONFIRMED,
      plan: { name: 'Starter Bulanan' },
      quantity: 1,
      months: 6,
      amount: '534600.00',
      promoDiscount: '600000.00',
      durationDiscount: '59400.00',
      extraStorageGb: 0,
      storageAmount: 0,
      confirmedAt: new Date('2026-10-15'),
    };

    it('returns a paid receipt to the owning clinic (positive)', async () => {
      paymentRepo.findOne.mockResolvedValue(confirmed);
      clinicRepo.find.mockResolvedValue([
        { id: 3, name: 'Klinik A', email: 'a@x' },
      ]);
      const r = await service.receipt(7, { clinicId: 3 });
      expect(r).toMatchObject({
        number: 'APX-000007',
        status: 'Lunas, dikonfirmasi',
        months: 6,
        amount: 534600,
        durationDiscount: 59400,
        billedTo: { name: 'Klinik A' },
      });
    });

    it("hides another clinic's or a pending payment (negative)", async () => {
      paymentRepo.findOne.mockResolvedValue(confirmed);
      await expect(service.receipt(7, { clinicId: 4 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      paymentRepo.findOne.mockResolvedValue({
        ...confirmed,
        status: SubscriptionPaymentStatus.PENDING,
      });
      await expect(
        service.receipt(7, { clinicId: null }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('naik/turun paket', () => {
    const starter = {
      id: 3,
      name: 'Starter',
      tier: SubscriptionPlanTier.BASIC,
      price: 199000,
      promoPrice: 99000,
      promoUntil: '2999-12-31',
      ownerFee: 0,
    };
    const pro = {
      id: 1,
      name: 'Pro',
      tier: SubscriptionPlanTier.PRO,
      price: 299000,
      promoPrice: 149000,
      promoUntil: '2999-12-31',
      ownerFee: 0,
      maxUsers: null,
    };

    it('quotes the price difference for the remaining days (positive)', async () => {
      plansService.findOne.mockResolvedValue(pro);
      clinicSubsService.getInEffectForClinic.mockResolvedValue({
        id: 9,
        planId: 3,
        plan: starter,
      });
      clinicSubsService.paidUntil.mockResolvedValue('2026-11-13');
      const q = await service.upgradeQuote(5, 1, '2026-10-15');
      // (149.000 − 99.000) × 30 hari / 30 = 50.000
      expect(q).toMatchObject({
        allowed: true,
        remainingDays: 30,
        monthlyDifference: 50000,
        amount: 50000,
      });
    });

    it('refuses an upgrade during the trial or to a lower plan (negative)', async () => {
      plansService.findOne.mockResolvedValue(pro);
      clinicSubsService.getInEffectForClinic.mockResolvedValue({
        id: 9,
        planId: 4,
        plan: { tier: SubscriptionPlanTier.TRIAL },
      });
      await expect(service.upgradeQuote(5, 1)).resolves.toMatchObject({
        allowed: false,
      });
      plansService.findOne.mockResolvedValue(starter);
      clinicSubsService.getInEffectForClinic.mockResolvedValue({
        id: 9,
        planId: 1,
        plan: pro,
      });
      await expect(service.upgradeQuote(5, 3)).resolves.toMatchObject({
        allowed: false,
      });
    });

    it('stores an upgrade claim without extending, and confirm applies it (positive)', async () => {
      plansService.findOne.mockResolvedValue(pro);
      clinicSubsService.getInEffectForClinic.mockResolvedValue({
        id: 9,
        planId: 3,
        plan: starter,
      });
      clinicSubsService.paidUntil.mockResolvedValue('2999-01-01');
      const claim = await service.claim(
        5,
        { planId: 1, kind: 'upgrade' } as any,
        9,
      );
      expect(claim).toMatchObject({ kind: 'upgrade', months: 0 });

      paymentRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 5,
        planId: 1,
        kind: 'upgrade',
        status: SubscriptionPaymentStatus.PENDING,
      });
      clinicSubsService.applyUpgrade.mockResolvedValue({ id: 77 });
      const confirmed = await service.confirm(1, {} as any, 30);
      expect(clinicSubsService.applyUpgrade).toHaveBeenCalledWith(5, 1, 30);
      expect(clinicSubsService.extendSubscription).not.toHaveBeenCalled();
      expect(confirmed.subscriptionId).toBe(77);
    });

    it('rejects a downgrade when active accounts exceed the target plan (negative)', async () => {
      clinicSubsService.getInEffectForClinic.mockResolvedValue({
        id: 9,
        planId: 1,
        plan: pro,
      });
      plansService.findOne.mockResolvedValue(starter);
      (clinicRepo as any).manager.query.mockResolvedValue([{ n: 8 }]);
      await expect(
        service.claim(5, { planId: 3 } as any, 9),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
