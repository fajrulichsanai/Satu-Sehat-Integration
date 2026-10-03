import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SubscriptionNotificationsService } from '../subscription-notifications.service';
import { ClinicSubscription, ClinicSubscriptionStatus } from '../entities/clinic-subscription.entity';
import { SubscriptionPlanTier } from '../entities/subscription-plan.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { User } from '../../users/entities/user.entity';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'mock' }) },
  })),
}));

function endDateInDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('SubscriptionNotificationsService', () => {
  let service: SubscriptionNotificationsService;
  let subRepo: { find: jest.Mock; save: jest.Mock };
  let clinicRepo: { findOne: jest.Mock };
  let userRepo: { find: jest.Mock };

  beforeEach(async () => {
    subRepo = { find: jest.fn(), save: jest.fn().mockResolvedValue(undefined) };
    clinicRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Klinik A' }) };
    userRepo = { find: jest.fn().mockResolvedValue([{ email: 'owner@x.com' }]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionNotificationsService,
        { provide: ConfigService, useValue: { get: jest.fn(() => 'test') } },
        { provide: getRepositoryToken(ClinicSubscription), useValue: subRepo },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<SubscriptionNotificationsService>(
      SubscriptionNotificationsService,
    );
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('sendUpcomingExpiryReminders', () => {
    it('sends an H-7 reminder for a subscription ending in exactly 7 days (positive)', async () => {
      subRepo.find.mockResolvedValue([
        { clinicId: 1, endDate: endDateInDays(7), notifiedH7At: null, notifiedH1At: null },
      ]);

      const result = await service.sendUpcomingExpiryReminders();

      expect(result.h7Sent).toBe(1);
      expect(subRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ notifiedH7At: expect.any(Date) }),
      );
    });

    it('sends an H-1 reminder for a subscription ending tomorrow (positive)', async () => {
      subRepo.find.mockResolvedValue([
        { clinicId: 1, endDate: endDateInDays(1), notifiedH1At: null, notifiedH7At: null },
      ]);

      const result = await service.sendUpcomingExpiryReminders();

      expect(result.h1Sent).toBe(1);
    });

    it('skips a subscription that was already notified for that milestone (negative/edge)', async () => {
      subRepo.find.mockResolvedValue([
        { clinicId: 1, endDate: endDateInDays(7), notifiedH7At: new Date() },
      ]);

      const result = await service.sendUpcomingExpiryReminders();

      expect(result.h7Sent).toBe(0);
    });

    it('skips a subscription not at exactly 7 or 1 days remaining (negative/edge)', async () => {
      subRepo.find.mockResolvedValue([
        { clinicId: 1, endDate: endDateInDays(3), notifiedH7At: null, notifiedH1At: null },
      ]);

      const result = await service.sendUpcomingExpiryReminders();

      expect(result).toEqual({ h7Sent: 0, h1Sent: 0 });
    });

    it('only considers the latest (first) row per clinic when duplicates exist (positive/edge)', async () => {
      subRepo.find.mockResolvedValue([
        { clinicId: 1, endDate: endDateInDays(7), notifiedH7At: null, notifiedH1At: null }, // latest (order id DESC)
        { clinicId: 1, endDate: endDateInDays(1), notifiedH7At: null, notifiedH1At: null }, // stale history row
      ]);

      const result = await service.sendUpcomingExpiryReminders();

      expect(result).toEqual({ h7Sent: 1, h1Sent: 0 });
    });

    it('does not mark as notified when there is no active owner email (negative)', async () => {
      userRepo.find.mockResolvedValue([]);
      subRepo.find.mockResolvedValue([
        { clinicId: 1, endDate: endDateInDays(7), notifiedH7At: null, notifiedH1At: null },
      ]);

      const result = await service.sendUpcomingExpiryReminders();

      expect(result.h7Sent).toBe(0);
      expect(subRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('sendTrialReminders', () => {
    it('sends a D7 (8-days-left) reminder only for TRIAL-tier subscriptions (positive)', async () => {
      subRepo.find.mockResolvedValue([
        {
          clinicId: 1,
          endDate: endDateInDays(8),
          plan: { tier: SubscriptionPlanTier.TRIAL },
          notifiedTrialD7At: null,
        },
      ]);

      const result = await service.sendTrialReminders();

      expect(result.d7Sent).toBe(1);
    });

    it('ignores non-TRIAL plans even at a matching day offset (negative/edge)', async () => {
      subRepo.find.mockResolvedValue([
        {
          clinicId: 1,
          endDate: endDateInDays(8),
          plan: { tier: SubscriptionPlanTier.PRO },
          notifiedTrialD7At: null,
        },
      ]);

      const result = await service.sendTrialReminders();

      expect(result).toEqual({ d7Sent: 0, d13Sent: 0, d15Sent: 0 });
    });

    it('sends the D13 (2-days-left) reminder (positive)', async () => {
      subRepo.find.mockResolvedValue([
        {
          clinicId: 1,
          endDate: endDateInDays(2),
          plan: { tier: SubscriptionPlanTier.TRIAL },
          notifiedTrialD13At: null,
        },
      ]);

      const result = await service.sendTrialReminders();

      expect(result.d13Sent).toBe(1);
    });

    it('sends the D15 (trial-ends-today) reminder (positive)', async () => {
      subRepo.find.mockResolvedValue([
        {
          clinicId: 1,
          endDate: endDateInDays(0),
          plan: { tier: SubscriptionPlanTier.TRIAL },
          notifiedTrialD15At: null,
        },
      ]);

      const result = await service.sendTrialReminders();

      expect(result.d15Sent).toBe(1);
    });

    it('skips a milestone already notified (negative/edge)', async () => {
      subRepo.find.mockResolvedValue([
        {
          clinicId: 1,
          endDate: endDateInDays(0),
          plan: { tier: SubscriptionPlanTier.TRIAL },
          notifiedTrialD15At: new Date(),
        },
      ]);

      const result = await service.sendTrialReminders();

      expect(result.d15Sent).toBe(0);
    });
  });
});
