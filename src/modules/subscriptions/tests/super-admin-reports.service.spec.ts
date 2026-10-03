import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SuperAdminReportsService } from '../super-admin-reports.service';
import {
  ClinicSubscription,
  ClinicSubscriptionStatus,
} from '../entities/clinic-subscription.entity';
import {
  SubscriptionPayment,
  SubscriptionPaymentStatus,
} from '../entities/subscription-payment.entity';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

function buildQb(result: any[] = []) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(result),
  };
}

describe('SuperAdminReportsService', () => {
  let service: SuperAdminReportsService;
  let clinicRepo: { count: jest.Mock; find: jest.Mock };
  let subRepo: { find: jest.Mock };
  let paymentRepo: { count: jest.Mock; createQueryBuilder: jest.Mock };
  let planRepo: { find: jest.Mock };

  beforeEach(async () => {
    clinicRepo = { count: jest.fn().mockResolvedValue(0), find: jest.fn().mockResolvedValue([]) };
    subRepo = { find: jest.fn().mockResolvedValue([]) };
    paymentRepo = {
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(() => buildQb()),
    };
    planRepo = { find: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuperAdminReportsService,
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: getRepositoryToken(ClinicSubscription), useValue: subRepo },
        { provide: getRepositoryToken(SubscriptionPayment), useValue: paymentRepo },
        { provide: getRepositoryToken(SubscriptionPlan), useValue: planRepo },
      ],
    }).compile();

    service = module.get<SuperAdminReportsService>(SuperAdminReportsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('counts active vs expired clinics based on their latest subscription (positive)', async () => {
    clinicRepo.count.mockResolvedValue(3);
    clinicRepo.find.mockResolvedValue([
      { id: 1, createdAt: new Date('2026-01-01') },
      { id: 2, createdAt: new Date('2026-01-02') },
      { id: 3, createdAt: new Date('2026-01-03') },
    ]);
    subRepo.find.mockResolvedValue([
      { clinicId: 1, status: ClinicSubscriptionStatus.ACTIVE, planId: 1 },
      { clinicId: 2, status: ClinicSubscriptionStatus.EXPIRED, planId: 1 },
      // clinic 3 has no subscription row at all
    ]);

    const result = await service.summary({} as any);

    expect(result.totalClinics).toBe(3);
    expect(result.activeClinics).toBe(1);
    expect(result.expiredClinics).toBe(2); // includes the clinic with no subscription
  });

  it('sums confirmed-payment amounts into totalRevenue (positive)', async () => {
    const confirmedQb = buildQb([
      { amount: '100000', confirmedAt: new Date() },
      { amount: '50000', confirmedAt: new Date() },
    ]);
    paymentRepo.createQueryBuilder.mockReturnValue(confirmedQb);

    const result = await service.summary({} as any);

    expect(result.totalRevenue).toBe(150000);
  });

  it('applies dateFrom/dateTo filters to the confirmed-payments query (positive)', async () => {
    const confirmedQb = buildQb([]);
    paymentRepo.createQueryBuilder.mockReturnValue(confirmedQb);

    await service.summary({ dateFrom: '2026-01-01', dateTo: '2026-01-31' } as any);

    expect(confirmedQb.andWhere).toHaveBeenCalledWith('p.confirmedAt >= :dateFrom', {
      dateFrom: '2026-01-01',
    });
    expect(confirmedQb.andWhere).toHaveBeenCalledWith('p.confirmedAt <= :dateTo', {
      dateTo: '2026-01-31',
    });
  });

  it('excludes payments confirmed more than 30 days ago from MRR (negative/edge)', async () => {
    const old = new Date();
    old.setDate(old.getDate() - 40);
    const recent = new Date();
    recent.setDate(recent.getDate() - 5);

    paymentRepo.createQueryBuilder.mockReturnValue(
      buildQb([
        { amount: '100000', confirmedAt: old },
        { amount: '75000', confirmedAt: recent },
      ]),
    );

    const result = await service.summary({} as any);

    expect(result.mrr).toBe(75000);
    expect(result.totalRevenue).toBe(175000); // total still includes the old payment
  });

  it('groups revenue and new-clinic counts by calendar month (positive)', async () => {
    clinicRepo.find.mockResolvedValue([
      { id: 1, createdAt: new Date('2026-01-15') },
      { id: 2, createdAt: new Date('2026-01-20') },
      { id: 3, createdAt: new Date('2026-02-01') },
    ]);
    paymentRepo.createQueryBuilder.mockReturnValue(
      buildQb([
        { amount: '100000', confirmedAt: new Date('2026-01-10') },
        { amount: '50000', confirmedAt: new Date('2026-02-05') },
      ]),
    );

    const result = await service.summary({} as any);

    expect(result.revenueByPeriod).toEqual([
      { period: '2026-01', revenue: 100000 },
      { period: '2026-02', revenue: 50000 },
    ]);
    expect(result.newClinicsByPeriod).toEqual([
      { period: '2026-01', count: 2 },
      { period: '2026-02', count: 1 },
    ]);
  });

  it('counts only ACTIVE subscribers per plan in planDistribution (positive)', async () => {
    clinicRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    subRepo.find.mockResolvedValue([
      { clinicId: 1, status: ClinicSubscriptionStatus.ACTIVE, planId: 10 },
      { clinicId: 2, status: ClinicSubscriptionStatus.EXPIRED, planId: 10 },
    ]);
    planRepo.find.mockResolvedValue([{ id: 10, name: 'Pro' }]);

    const result = await service.summary({} as any);

    expect(result.planDistribution).toEqual([
      { planId: 10, planName: 'Pro', count: 1 },
    ]);
  });

  it('returns all zeros for a system with no clinics yet (negative/edge)', async () => {
    const result = await service.summary({} as any);
    expect(result).toMatchObject({
      totalClinics: 0,
      activeClinics: 0,
      expiredClinics: 0,
      pendingConfirmations: 0,
      mrr: 0,
      totalRevenue: 0,
    });
  });
});
