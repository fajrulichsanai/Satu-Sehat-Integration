import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportsService } from '../reports.service';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { Billing } from '../../billing/entities/billing.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { SatusehatSyncLog, SyncLogStatus } from '../../satusehat/sync/entities/satusehat-sync-log.entity';
import { BillingItem } from '../../billing-item/entities/billing-item.entity';
import { DoctorFeeConfig, FeeType } from '../../doctor-fee/entities/doctor-fee-config.entity';
import { OperationalRecord } from '../../operational-records/entities/operational-record.entity';
import { Barang } from '../../gudang/entities/barang.entity';
import { StokTransaksi } from '../../gudang/entities/stok-transaksi.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { PatientOriginGeocode } from '../entities/patient-origin-geocode.entity';

function buildQb(overrides: Partial<Record<string, any>> = {}) {
  return {
    createQueryBuilder: undefined,
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
    ...overrides,
  };
}

describe('ReportsService', () => {
  let service: ReportsService;
  let billingRepo: { query: jest.Mock };
  let billingItemRepo: { query: jest.Mock };
  let syncLogRepo: {
    createQueryBuilder: jest.Mock;
    query: jest.Mock;
    find: jest.Mock;
  };

  beforeEach(async () => {
    billingRepo = { query: jest.fn() };
    billingItemRepo = { query: jest.fn() };
    syncLogRepo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      query: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Encounter), useValue: { createQueryBuilder: jest.fn(), query: jest.fn() } },
        { provide: getRepositoryToken(Billing), useValue: billingRepo },
        { provide: getRepositoryToken(Payment), useValue: {} },
        { provide: getRepositoryToken(SatusehatSyncLog), useValue: syncLogRepo },
        { provide: getRepositoryToken(BillingItem), useValue: billingItemRepo },
        { provide: getRepositoryToken(DoctorFeeConfig), useValue: {} },
        { provide: getRepositoryToken(OperationalRecord), useValue: {} },
        { provide: getRepositoryToken(Barang), useValue: {} },
        { provide: getRepositoryToken(StokTransaksi), useValue: {} },
        { provide: getRepositoryToken(Patient), useValue: {} },
        { provide: getRepositoryToken(PatientOriginGeocode), useValue: {} },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('getDoctorFeeShareReport', () => {
    it('computes percentage-based fee share per practitioner (positive)', async () => {
      billingItemRepo.query.mockResolvedValue([
        {
          practitionerId: 1,
          practitionerName: 'Dr. A',
          tarifId: 10,
          tarifName: 'Tambal',
          hargaJual: '100000',
          count: '4',
          feeType: FeeType.PERCENTAGE,
          feeValue: '20',
        },
      ]);

      const result = await service.getDoctorFeeShareReport(1, {
        year: 2026,
        month: 1,
      } as any);

      expect(result.data[0].totalShareFee).toBe(4 * (100000 * 0.2));
      expect(result.data[0].breakdown[0].totalShare).toBe(80000);
    });

    it('computes fixed-fee share per practitioner (positive)', async () => {
      billingItemRepo.query.mockResolvedValue([
        {
          practitionerId: 1,
          practitionerName: 'Dr. A',
          tarifId: 10,
          tarifName: 'Tambal',
          hargaJual: '100000',
          count: '3',
          feeType: FeeType.FIXED,
          feeValue: '25000',
        },
      ]);

      const result = await service.getDoctorFeeShareReport(1, {
        year: 2026,
        month: 1,
      } as any);

      expect(result.data[0].totalShareFee).toBe(75000);
    });

    it('defaults to PERCENTAGE fee type when no doctor-fee config exists (edge)', async () => {
      billingItemRepo.query.mockResolvedValue([
        {
          practitionerId: 1,
          practitionerName: 'Dr. A',
          tarifId: 10,
          tarifName: 'Tambal',
          hargaJual: '100000',
          count: '1',
          feeType: null,
          feeValue: null,
        },
      ]);

      const result = await service.getDoctorFeeShareReport(1, {
        year: 2026,
        month: 1,
      } as any);

      expect(result.data[0].totalShareFee).toBe(0); // feeValue defaults to 0
      expect(result.data[0].breakdown[0].feeType).toBe(FeeType.PERCENTAGE);
    });

    it('sums multiple tarifs for the same practitioner and sorts practitioners by total share desc (positive)', async () => {
      billingItemRepo.query.mockResolvedValue([
        {
          practitionerId: 1,
          practitionerName: 'Dr. A',
          tarifId: 10,
          tarifName: 'Tambal',
          hargaJual: '50000',
          count: '2',
          feeType: FeeType.FIXED,
          feeValue: '10000',
        },
        {
          practitionerId: 2,
          practitionerName: 'Dr. B',
          tarifId: 11,
          tarifName: 'Cabut',
          hargaJual: '100000',
          count: '5',
          feeType: FeeType.FIXED,
          feeValue: '20000',
        },
      ]);

      const result = await service.getDoctorFeeShareReport(1, {
        year: 2026,
        month: 1,
      } as any);

      expect(result.data[0].practitionerId).toBe(2); // 100000 > 20000, sorted desc
      expect(result.data).toHaveLength(2);
    });

    it('returns an empty list when there is no billing activity (negative/edge)', async () => {
      billingItemRepo.query.mockResolvedValue([]);
      const result = await service.getDoctorFeeShareReport(1, {
        year: 2026,
        month: 1,
      } as any);
      expect(result.data).toEqual([]);
    });
  });

  describe('getTrailingMonthKeys (private)', () => {
    it('returns N consecutive YYYY-MM keys ending at the current month (positive)', () => {
      const keys = (service as any).getTrailingMonthKeys(3);
      expect(keys).toHaveLength(3);
      const now = new Date();
      const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      expect(keys[keys.length - 1]).toBe(currentKey);
    });

    it('returns a single-element array for monthCount=1 (edge)', () => {
      const keys = (service as any).getTrailingMonthKeys(1);
      expect(keys).toHaveLength(1);
    });
  });

  describe('computeLtv (private)', () => {
    it('averages lifetime value and visit count across patients (positive)', async () => {
      billingRepo.query.mockResolvedValue([
        { avgLtv: '500000', avgVisits: '2.5', patientCount: '10' },
      ]);
      const result = await (service as any).computeLtv(1);
      expect(result).toEqual({
        averageLtv: 500000,
        averageVisitsPerPatient: 2.5,
        patientCount: 10,
      });
    });

    it('defaults to zeros when the clinic has no paid billings (negative/edge)', async () => {
      billingRepo.query.mockResolvedValue([
        { avgLtv: null, avgVisits: null, patientCount: '0' },
      ]);
      const result = await (service as any).computeLtv(1);
      expect(result).toEqual({
        averageLtv: 0,
        averageVisitsPerPatient: 0,
        patientCount: 0,
      });
    });
  });

  describe('computeArpv (private)', () => {
    it('divides total paid by number of billings (positive)', async () => {
      billingRepo.query.mockResolvedValue([
        { totalPaid: '1000000', totalBillings: '4' },
      ]);
      const result = await (service as any).computeArpv(1, '2026-01-01', '2026-01-31');
      expect(result).toBe(250000);
    });

    it('returns 0 when there are no billings in the period (negative/edge)', async () => {
      billingRepo.query.mockResolvedValue([
        { totalPaid: null, totalBillings: '0' },
      ]);
      const result = await (service as any).computeArpv(1, '2026-01-01', '2026-01-31');
      expect(result).toBe(0);
    });
  });

  describe('computeParetoConcentration (private)', () => {
    it('computes the top-20%-patients revenue share (positive)', async () => {
      // 5 patients, sorted desc by total already (as SQL would return)
      billingRepo.query.mockResolvedValue([
        { patient_id: 1, total: '500' },
        { patient_id: 2, total: '200' },
        { patient_id: 3, total: '150' },
        { patient_id: 4, total: '100' },
        { patient_id: 5, total: '50' },
      ]);
      const result = await (service as any).computeParetoConcentration(
        1,
        '2026-01-01',
        '2026-01-31',
      );
      // top20Count = ceil(5*0.2) = 1 -> top patient (500) / total (1000) = 50%
      expect(result.top20PercentPatientShare).toBe(50);
      expect(result.patientCount).toBe(5);
    });

    it('always includes at least one patient even with a tiny patient count (edge)', async () => {
      billingRepo.query.mockResolvedValue([{ patient_id: 1, total: '100' }]);
      const result = await (service as any).computeParetoConcentration(
        1,
        '2026-01-01',
        '2026-01-31',
      );
      expect(result.top20PercentPatientShare).toBe(100);
    });

    it('returns zeros when there is no revenue in the period (negative/edge)', async () => {
      billingRepo.query.mockResolvedValue([]);
      const result = await (service as any).computeParetoConcentration(
        1,
        '2026-01-01',
        '2026-01-31',
      );
      expect(result).toEqual({ top20PercentPatientShare: 0, patientCount: 0 });
    });
  });

  describe('computeDso (private)', () => {
    it('rounds the average outstanding age in days (positive)', async () => {
      billingRepo.query.mockResolvedValue([{ avgAgeDays: '14.6', count: '3' }]);
      const result = await (service as any).computeDso(1);
      expect(result).toEqual({ averageDays: 15, outstandingCount: 3 });
    });

    it('returns zero average days when nothing is outstanding (negative/edge)', async () => {
      billingRepo.query.mockResolvedValue([{ avgAgeDays: null, count: '0' }]);
      const result = await (service as any).computeDso(1);
      expect(result).toEqual({ averageDays: 0, outstandingCount: 0 });
    });
  });

  describe('computeRetentionRate (private)', () => {
    it('computes the percentage of previous-period patients who returned (positive)', async () => {
      billingRepo.query.mockResolvedValue([
        { prevPatients: '10', returningPatients: '4' },
      ]);
      const result = await (service as any).computeRetentionRate(
        1,
        '2026-02-01',
        '2026-02-28',
      );
      expect(result.retentionRatePercent).toBe(40);
      expect(result.previousPeriodPatients).toBe(10);
      expect(result.returningPatients).toBe(4);
    });

    it('returns null retention rate (not 0) when there were no patients in the previous period (negative/edge)', async () => {
      billingRepo.query.mockResolvedValue([
        { prevPatients: '0', returningPatients: '0' },
      ]);
      const result = await (service as any).computeRetentionRate(
        1,
        '2026-02-01',
        '2026-02-28',
      );
      expect(result.retentionRatePercent).toBeNull();
    });
  });

  describe('getSatusehatSyncReport', () => {
    it('computes the sync rate and per-resource breakdown (positive)', async () => {
      syncLogRepo.query
        .mockResolvedValueOnce([{ total: '10', synced: '8', failed: '2', pending: '0' }])
        .mockResolvedValueOnce([
          { resourceType: 'Patient', synced: '5', failed: '1', pending: '0' },
        ]);
      syncLogRepo.find.mockResolvedValue([]);

      const result = await service.getSatusehatSyncReport(1, {} as any);

      expect(result.data.summary.syncRate).toBe(80);
      expect(result.data.byResource[0].resourceType).toBe('Patient');
    });

    it('reports a 0% sync rate instead of NaN when there are no sync logs yet (negative/edge)', async () => {
      syncLogRepo.query
        .mockResolvedValueOnce([{ total: '0', synced: '0', failed: '0', pending: '0' }])
        .mockResolvedValueOnce([]);
      syncLogRepo.find.mockResolvedValue([]);

      const result = await service.getSatusehatSyncReport(1, {} as any);

      expect(result.data.summary.syncRate).toBe(0);
    });

    it('lists up to the most recent failed items with error details (positive)', async () => {
      syncLogRepo.query
        .mockResolvedValueOnce([{ total: '1', synced: '0', failed: '1', pending: '0' }])
        .mockResolvedValueOnce([]);
      syncLogRepo.find.mockResolvedValue([
        {
          resourceType: 'Encounter',
          localId: '5',
          errorMessage: 'timeout',
          retryCount: 1,
          createdAt: new Date('2026-01-01'),
        },
      ]);

      const result = await service.getSatusehatSyncReport(1, {} as any);

      expect(result.data.failedItems[0].errorMessage).toBe('timeout');
    });
  });

  describe('retrySync', () => {
    it('reports the number of queued retries (positive)', async () => {
      const qb = buildQb({ execute: jest.fn().mockResolvedValue({ affected: 3 }) });
      syncLogRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.retrySync(1, {} as any);

      expect(result.queued).toBe(3);
    });

    it('filters by resourceType when provided (positive)', async () => {
      const qb = buildQb();
      syncLogRepo.createQueryBuilder.mockReturnValue(qb);

      await service.retrySync(1, { resourceType: 'Patient' } as any);

      expect(qb.andWhere).toHaveBeenCalledWith('resourceType = :resourceType', {
        resourceType: 'Patient',
      });
    });

    it('reports 0 queued when nothing matches (negative/edge)', async () => {
      const qb = buildQb({ execute: jest.fn().mockResolvedValue({ affected: 0 }) });
      syncLogRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.retrySync(1, {} as any);

      expect(result.queued).toBe(0);
    });
  });
});
