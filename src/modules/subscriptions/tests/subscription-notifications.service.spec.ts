import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { SubscriptionNotificationsService } from '../subscription-notifications.service';
import {
  ClinicSubscription,
  ClinicSubscriptionStatus,
} from '../entities/clinic-subscription.entity';
import { SubscriptionPlanTier } from '../entities/subscription-plan.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { User } from '../../users/entities/user.entity';
import { OwnerClinicLink } from '../../multi-clinic/entities/owner-clinic-link.entity';
import { Resend } from 'resend';

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
  let linkRepo: { findOne: jest.Mock };
  let manager: { query: jest.Mock };
  const sentEmails = () =>
    (Resend as unknown as jest.Mock).mock.results.at(-1)!.value.emails
      .send as jest.Mock;

  beforeEach(async () => {
    manager = {
      query: jest.fn().mockResolvedValue([{ name: 'Multi Klinik Bulanan' }]),
    };
    subRepo = {
      find: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
      manager,
    } as any;
    linkRepo = { findOne: jest.fn().mockResolvedValue(null) };
    clinicRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Klinik A' }),
      find: jest.fn().mockResolvedValue([
        { id: 10, name: 'Cabang A' },
        { id: 11, name: 'Cabang B' },
      ]),
    } as any;
    userRepo = {
      find: jest.fn().mockResolvedValue([{ email: 'owner@x.com' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionNotificationsService,
        { provide: ConfigService, useValue: { get: jest.fn(() => 'test') } },
        { provide: getRepositoryToken(ClinicSubscription), useValue: subRepo },
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(OwnerClinicLink), useValue: linkRepo },
      ],
    }).compile();

    service = module.get<SubscriptionNotificationsService>(
      SubscriptionNotificationsService,
    );
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('sendUpcomingExpiryReminders', () => {
    it('sends the reminder of an owner-paid branch to the multiklinik owner (positive)', async () => {
      linkRepo.findOne.mockResolvedValue({
        owner: { email: 'mco@x.id', isActive: true },
      });
      subRepo.find.mockResolvedValue([
        {
          clinicId: 1,
          endDate: endDateInDays(7),
          notifiedH7At: null,
          notifiedH1At: null,
        },
      ]);

      const result = await service.sendUpcomingExpiryReminders();

      expect(result.h7Sent).toBe(1);
      const mail = sentEmails().mock.calls[0][0];
      expect(mail.to).toEqual(['mco@x.id']);
      expect(mail.html).toContain('/multi-klinik/langganan');
    });

    it('sends an H-7 reminder for a subscription ending in exactly 7 days (positive)', async () => {
      subRepo.find.mockResolvedValue([
        {
          clinicId: 1,
          endDate: endDateInDays(7),
          notifiedH7At: null,
          notifiedH1At: null,
        },
      ]);

      const result = await service.sendUpcomingExpiryReminders();

      expect(result.h7Sent).toBe(1);
      expect(subRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ notifiedH7At: expect.any(Date) }),
      );
    });

    it('sends an H-1 reminder for a subscription ending tomorrow (positive)', async () => {
      subRepo.find.mockResolvedValue([
        {
          clinicId: 1,
          endDate: endDateInDays(1),
          notifiedH1At: null,
          notifiedH7At: null,
        },
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

    it('sends the H-3 reminder once (positive)', async () => {
      subRepo.find.mockResolvedValue([
        {
          clinicId: 1,
          endDate: endDateInDays(3),
          notifiedH7At: null,
          notifiedH3At: null,
          notifiedH1At: null,
        },
      ]);

      const result = await service.sendUpcomingExpiryReminders();

      expect(result).toEqual({ h7Sent: 0, h3Sent: 1, h1Sent: 0 });
    });

    it('skips a subscription not at exactly 7, 3 or 1 days remaining (negative/edge)', async () => {
      subRepo.find.mockResolvedValue([
        {
          clinicId: 1,
          endDate: endDateInDays(4),
          notifiedH7At: null,
          notifiedH1At: null,
        },
      ]);

      const result = await service.sendUpcomingExpiryReminders();

      expect(result).toEqual({ h7Sent: 0, h3Sent: 0, h1Sent: 0 });
    });

    it('only considers the latest (first) row per clinic when duplicates exist (positive/edge)', async () => {
      subRepo.find.mockResolvedValue([
        {
          clinicId: 1,
          endDate: endDateInDays(7),
          notifiedH7At: null,
          notifiedH1At: null,
        }, // latest (order id DESC)
        {
          clinicId: 1,
          endDate: endDateInDays(1),
          notifiedH7At: null,
          notifiedH1At: null,
        }, // stale history row
      ]);

      const result = await service.sendUpcomingExpiryReminders();

      expect(result).toEqual({ h7Sent: 1, h3Sent: 0, h1Sent: 0 });
    });

    it('does not mark as notified when there is no active owner email (negative)', async () => {
      userRepo.find.mockResolvedValue([]);
      subRepo.find.mockResolvedValue([
        {
          clinicId: 1,
          endDate: endDateInDays(7),
          notifiedH7At: null,
          notifiedH1At: null,
        },
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
  describe('sendPaymentReceipt', () => {
    it('emails the multiklinik owner a receipt listing every covered branch (positive)', async () => {
      userRepo.find.mockResolvedValue([{ email: 'mco@x.id' }]);
      const ok = await service.sendPaymentReceipt({
        id: 7,
        ownerId: 5,
        clinicId: null,
        coveredClinicIds: [10, 11],
        planId: 2,
        quantity: 2,
        amount: 298000,
        confirmedAt: new Date('2026-10-15'),
      } as any);

      expect(ok).toBe(true);
      const mail = sentEmails().mock.calls[0][0];
      expect(mail.to).toEqual(['mco@x.id']);
      expect(mail.subject).toContain('APX-000007');
      expect(mail.html).toContain('Cabang A');
      expect(mail.html).toContain('Cabang B');
      expect(mail.html).toContain('298.000');
    });

    it('does nothing without a recipient (negative)', async () => {
      userRepo.find.mockResolvedValue([]);
      const ok = await service.sendPaymentReceipt({
        id: 8,
        clinicId: 1,
        ownerId: null,
        planId: 2,
        quantity: 1,
        amount: 99000,
      } as any);
      expect(ok).toBe(false);
    });
  });
});
