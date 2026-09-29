import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from '../dashboard.service';
import { Patient } from '../../patients/entities/patient.entity';
import { Practitioner } from '../../practitioners/entities/practitioner.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { Billing } from '../../billing/entities/billing.entity';
import { Tarif } from '../../tarif/entities/tarif.entity';
import { User } from '../../users/entities/user.entity';

function buildCountQb(count = 0) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(count),
  };
}

function buildRawOneQb(row: any = null) {
  return {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(row),
  };
}

function buildRawManyQb(rows: any[] = []) {
  return {
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
}

describe('DashboardService', () => {
  let service: DashboardService;
  let patientRepo: { count: jest.Mock };
  let practitionerRepo: { count: jest.Mock };
  let encounterRepo: { createQueryBuilder: jest.Mock };
  let billingRepo: {
    createQueryBuilder: jest.Mock;
    count: jest.Mock;
    query: jest.Mock;
  };
  let tarifRepo: { count: jest.Mock };
  let userRepo: { count: jest.Mock };

  beforeEach(async () => {
    patientRepo = { count: jest.fn().mockResolvedValue(5) };
    practitionerRepo = { count: jest.fn().mockResolvedValue(2) };
    encounterRepo = {
      createQueryBuilder: jest.fn(() => buildCountQb(1)),
    };
    billingRepo = {
      createQueryBuilder: jest.fn(() => buildRawOneQb({ total: '150000' })),
      count: jest.fn().mockResolvedValue(20),
      query: jest.fn().mockResolvedValue([{ total: '500000' }]),
    };
    tarifRepo = { count: jest.fn().mockResolvedValue(8) };
    userRepo = { count: jest.fn().mockResolvedValue(3) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: getRepositoryToken(Practitioner), useValue: practitionerRepo },
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
        { provide: getRepositoryToken(Billing), useValue: billingRepo },
        { provide: getRepositoryToken(Tarif), useValue: tarifRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('getSummary', () => {
    it('aggregates all metrics for the clinic (positive)', async () => {
      const result = await service.getSummary(1);
      expect(result).toEqual({
        totalPatients: 5,
        activePractitioners: 2,
        todayVisits: 1,
        pendingVisits: 1,
        monthlyRevenue: 150000,
        activeTarifs: 8,
        totalTransactions: 20,
        registeredUsers: 3,
      });
    });

    it('defaults monthlyRevenue to 0 when there is no billing this month (negative/edge)', async () => {
      billingRepo.createQueryBuilder.mockReturnValue(buildRawOneQb(null));
      const result = await service.getSummary(1);
      expect(result.monthlyRevenue).toBe(0);
    });
  });

  describe('getRecentActivity', () => {
    it('merges encounters and billings sorted by recency (positive)', async () => {
      encounterRepo.createQueryBuilder = jest.fn(() =>
        buildRawManyQb([
          {
            id: 1,
            status: 'finished',
            finishedTime: new Date('2026-01-02T10:00:00Z'),
            arrivedTime: new Date('2026-01-02T09:00:00Z'),
            chiefComplaint: 'Sakit gigi',
            patientName: 'Budi',
            practitionerName: 'Dr. A',
          },
        ]),
      );
      billingRepo.createQueryBuilder = jest.fn(() =>
        buildRawManyQb([
          {
            id: 1,
            grandTotal: 100000,
            status: 'paid',
            createdAt: new Date('2026-01-02T11:00:00Z'),
          },
        ]),
      );

      const result = await service.getRecentActivity(1, 10);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('billing'); // most recent timestamp first
      expect(result[1].type).toBe('encounter');
    });

    it('returns an empty list when there is no activity (negative/edge)', async () => {
      encounterRepo.createQueryBuilder = jest.fn(() => buildRawManyQb([]));
      billingRepo.createQueryBuilder = jest.fn(() => buildRawManyQb([]));

      const result = await service.getRecentActivity(1);
      expect(result).toEqual([]);
    });

    it('truncates merged activity to the given limit (edge)', async () => {
      const many = Array.from({ length: 5 }, (_, i) => ({
        id: i,
        status: 'finished',
        finishedTime: new Date(2026, 0, i + 1),
        arrivedTime: new Date(2026, 0, i + 1),
        chiefComplaint: 'X',
        patientName: 'P',
        practitionerName: 'D',
      }));
      encounterRepo.createQueryBuilder = jest.fn(() => buildRawManyQb(many));
      billingRepo.createQueryBuilder = jest.fn(() => buildRawManyQb([]));

      const result = await service.getRecentActivity(1, 2);
      expect(result).toHaveLength(2);
    });
  });

  describe('getModuleHighlights', () => {
    it('combines summary with weekly revenue (positive)', async () => {
      const result = await service.getModuleHighlights(1);
      expect(result.pasien.total).toBe(5);
      expect(result.laporanKeuangan.total7Hari).toBe(500000);
      expect(result.kunjungan).toEqual({ total: 1, pending: 1 });
    });

    it('defaults weekly revenue to 0 when the raw query returns nothing (negative/edge)', async () => {
      billingRepo.query.mockResolvedValue([{ total: null }]);
      const result = await service.getModuleHighlights(1);
      expect(result.laporanKeuangan.total7Hari).toBe(0);
    });
  });
});
