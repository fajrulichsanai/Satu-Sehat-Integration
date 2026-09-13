import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportsService } from '../reports.service';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { Billing } from '../../billing/entities/billing.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { SatusehatSyncLog } from '../../satusehat/sync/entities/satusehat-sync-log.entity';
import { BillingItem } from '../../billing-item/entities/billing-item.entity';
import { DoctorFeeConfig, FeeType } from '../../doctor-fee/entities/doctor-fee-config.entity';
import { OperationalRecord } from '../../operational-records/entities/operational-record.entity';
import { Barang } from '../../gudang/entities/barang.entity';
import { StokTransaksi } from '../../gudang/entities/stok-transaksi.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { PatientOriginGeocode } from '../entities/patient-origin-geocode.entity';
import { UserRole } from '../../../enums/user-role.enum';

function buildQb(overrides: Partial<Record<string, any>> = {}) {
  return {
    select: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ affected: 0 }),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    ...overrides,
  };
}

describe('ReportsService', () => {
  let service: ReportsService;
  let encounterRepo: { createQueryBuilder: jest.Mock; query: jest.Mock };
  let billingRepo: { query: jest.Mock };
  let paymentRepo: { query: jest.Mock };
  let syncLogRepo: {
    createQueryBuilder: jest.Mock;
    query: jest.Mock;
    find: jest.Mock;
  };
  let billingItemRepo: { query: jest.Mock };
  let operationalRecordRepo: { query: jest.Mock };
  let barangRepo: { query: jest.Mock };
  let stokTransaksiRepo: { query: jest.Mock };
  let patientRepo: { query: jest.Mock };
  let patientOriginGeocodeRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(async () => {
    encounterRepo = { createQueryBuilder: jest.fn(() => buildQb()), query: jest.fn() };
    billingRepo = { query: jest.fn() };
    paymentRepo = { query: jest.fn() };
    syncLogRepo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      query: jest.fn(),
      find: jest.fn(),
    };
    billingItemRepo = { query: jest.fn() };
    operationalRecordRepo = { query: jest.fn() };
    barangRepo = { query: jest.fn() };
    stokTransaksiRepo = { query: jest.fn() };
    patientRepo = { query: jest.fn() };
    patientOriginGeocodeRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
        { provide: getRepositoryToken(Billing), useValue: billingRepo },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
        { provide: getRepositoryToken(SatusehatSyncLog), useValue: syncLogRepo },
        { provide: getRepositoryToken(BillingItem), useValue: billingItemRepo },
        { provide: getRepositoryToken(DoctorFeeConfig), useValue: {} },
        { provide: getRepositoryToken(OperationalRecord), useValue: operationalRecordRepo },
        { provide: getRepositoryToken(Barang), useValue: barangRepo },
        { provide: getRepositoryToken(StokTransaksi), useValue: stokTransaksiRepo },
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: getRepositoryToken(PatientOriginGeocode), useValue: patientOriginGeocodeRepo },
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

    it('appends a practitioner filter to the SQL and params when practitionerId is given (positive)', async () => {
      billingItemRepo.query.mockResolvedValue([]);

      await service.getDoctorFeeShareReport(1, { year: 2026, month: 1 } as any, 42);

      const [sql, params] = billingItemRepo.query.mock.calls[0];
      expect(sql).toContain('AND pr.id = ?');
      expect(params).toEqual([1, 2026, 1, 42]);
    });

    it('maps the filtered row through to a full, correct breakdown when practitionerId is given (positive, end-to-end)', async () => {
      // Guards against a regression where the SQL filter is appended but the
      // result-mapping logic silently drops or mis-scopes the filtered row —
      // i.e. this checks the actual DATA returned, not just the query args.
      billingItemRepo.query.mockResolvedValue([
        {
          practitionerId: 42,
          practitionerName: 'Dr. Own',
          tarifId: 7,
          tarifName: 'Scaling',
          hargaJual: '200000',
          count: '2',
          feeType: FeeType.PERCENTAGE,
          feeValue: '15',
        },
      ]);

      const result = await service.getDoctorFeeShareReport(1, { year: 2026, month: 1 } as any, 42);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].practitionerId).toBe(42);
      expect(result.data[0].practitionerName).toBe('Dr. Own');
      expect(result.data[0].totalTindakan).toBe(2);
      expect(result.data[0].totalShareFee).toBe(2 * (200000 * 0.15));
      expect(result.data[0].breakdown).toEqual([
        expect.objectContaining({ tarifId: 7, tarifName: 'Scaling', count: 2, feeType: FeeType.PERCENTAGE }),
      ]);
    });

    it('does not filter by practitioner when practitionerId is omitted (positive/edge)', async () => {
      billingItemRepo.query.mockResolvedValue([]);

      await service.getDoctorFeeShareReport(1, { year: 2026, month: 1 } as any);

      const [sql, params] = billingItemRepo.query.mock.calls[0];
      expect(sql).not.toContain('AND pr.id = ?');
      expect(params).toEqual([1, 2026, 1]);
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

  describe('computeCategoryProfitability (private)', () => {
    it('computes net profit and margin per tarif category (positive)', async () => {
      billingItemRepo.query.mockResolvedValue([
        { kategori: 'Konservasi', frekuensi: '10', pendapatan: '1000000', modal: '400000' },
      ]);

      const result = await (service as any).computeCategoryProfitability(
        1,
        '2026-01-01',
        '2026-01-31',
      );

      expect(result).toEqual([
        {
          kategori: 'Konservasi',
          frekuensi: 10,
          pendapatan: 1000000,
          modal: 400000,
          labaBersih: 600000,
          marginPersen: 60,
        },
      ]);
    });

    it('labels a null/empty kategori as "Lainnya" (edge)', async () => {
      billingItemRepo.query.mockResolvedValue([
        { kategori: null, frekuensi: '1', pendapatan: '10000', modal: '5000' },
      ]);
      const result = await (service as any).computeCategoryProfitability(
        1,
        '2026-01-01',
        '2026-01-31',
      );
      expect(result[0].kategori).toBe('Lainnya');
    });

    it('avoids division by zero when pendapatan is 0 (negative/edge)', async () => {
      billingItemRepo.query.mockResolvedValue([
        { kategori: 'Promo', frekuensi: '2', pendapatan: '0', modal: '0' },
      ]);
      const result = await (service as any).computeCategoryProfitability(
        1,
        '2026-01-01',
        '2026-01-31',
      );
      expect(result[0].marginPersen).toBe(0);
    });

    it('returns an empty array when nothing was billed in the period (negative/edge)', async () => {
      billingItemRepo.query.mockResolvedValue([]);
      const result = await (service as any).computeCategoryProfitability(
        1,
        '2026-01-01',
        '2026-01-31',
      );
      expect(result).toEqual([]);
    });
  });

  describe('computeMarketingMetrics (private)', () => {
    it('computes CAC and LTV:CAC ratio when both ad spend and new patients exist (positive)', async () => {
      operationalRecordRepo.query.mockResolvedValue([{ total: '1000000' }]);
      encounterRepo.query.mockResolvedValue([{ count: '10' }]);

      const result = await (service as any).computeMarketingMetrics(
        1,
        '2026-01-01',
        '2026-01-31',
        300000, // averageLtv
      );

      expect(result.totalAdSpend).toBe(1000000);
      expect(result.newPatients).toBe(10);
      expect(result.cac).toBe(100000); // 1,000,000 / 10
      expect(result.ltvCacRatio).toBe(3); // 300,000 / 100,000
    });

    it('reports CAC as null (not 0) when there is no ad-spend data recorded (negative/edge)', async () => {
      operationalRecordRepo.query.mockResolvedValue([{ total: null }]);
      encounterRepo.query.mockResolvedValue([{ count: '10' }]);

      const result = await (service as any).computeMarketingMetrics(
        1,
        '2026-01-01',
        '2026-01-31',
        300000,
      );

      expect(result.cac).toBeNull();
      expect(result.ltvCacRatio).toBeNull();
    });

    it('reports CAC as null when there are no new patients, even with ad spend recorded (negative/edge)', async () => {
      operationalRecordRepo.query.mockResolvedValue([{ total: '500000' }]);
      encounterRepo.query.mockResolvedValue([{ count: '0' }]);

      const result = await (service as any).computeMarketingMetrics(
        1,
        '2026-01-01',
        '2026-01-31',
        300000,
      );

      expect(result.newPatients).toBe(0);
      expect(result.cac).toBeNull();
    });

    it('reports ltvCacRatio as 0 (not null) when CAC is positive but averageLtv is 0 (edge)', async () => {
      operationalRecordRepo.query.mockResolvedValue([{ total: '1000000' }]);
      encounterRepo.query.mockResolvedValue([{ count: '10' }]);

      const result = await (service as any).computeMarketingMetrics(
        1,
        '2026-01-01',
        '2026-01-31',
        0,
      );

      expect(result.cac).toBe(100000);
      expect(result.ltvCacRatio).toBe(0);
    });
  });

  describe('computeBusinessMetrics (private)', () => {
    it('assembles all sub-metrics into a single object, threading averageLtv into the marketing calc (positive)', async () => {
      const ltvSpy = jest
        .spyOn(service as any, 'computeLtv')
        .mockResolvedValue({ averageLtv: 777, averageVisitsPerPatient: 2, patientCount: 9 });
      const arpvSpy = jest.spyOn(service as any, 'computeArpv').mockResolvedValue(111);
      const paretoSpy = jest
        .spyOn(service as any, 'computeParetoConcentration')
        .mockResolvedValue({ top20PercentPatientShare: 40, patientCount: 9 });
      const dsoSpy = jest
        .spyOn(service as any, 'computeDso')
        .mockResolvedValue({ averageDays: 3, outstandingCount: 1 });
      const retentionSpy = jest
        .spyOn(service as any, 'computeRetentionRate')
        .mockResolvedValue({ retentionRatePercent: 25, previousPeriodPatients: 4, returningPatients: 1 });
      const categorySpy = jest
        .spyOn(service as any, 'computeCategoryProfitability')
        .mockResolvedValue([{ kategori: 'X' }]);
      const marketingSpy = jest
        .spyOn(service as any, 'computeMarketingMetrics')
        .mockResolvedValue({ totalAdSpend: 0, newPatients: 0, cac: null, ltvCacRatio: null });

      const result = await (service as any).computeBusinessMetrics(
        1,
        '2026-01-01',
        '2026-01-31',
      );

      expect(marketingSpy).toHaveBeenCalledWith(1, '2026-01-01', '2026-01-31', 777);
      expect(result).toEqual({
        ltv: { averageLtv: 777, averageVisitsPerPatient: 2, patientCount: 9 },
        arpv: 111,
        pareto: { top20PercentPatientShare: 40, patientCount: 9 },
        dso: { averageDays: 3, outstandingCount: 1 },
        retention: { retentionRatePercent: 25, previousPeriodPatients: 4, returningPatients: 1 },
        categoryProfitability: [{ kategori: 'X' }],
        marketing: { totalAdSpend: 0, newPatients: 0, cac: null, ltvCacRatio: null },
      });

      ltvSpy.mockRestore();
      arpvSpy.mockRestore();
      paretoSpy.mockRestore();
      dsoSpy.mockRestore();
      retentionSpy.mockRestore();
      categorySpy.mockRestore();
      marketingSpy.mockRestore();
    });
  });

  describe('computeMonthlyTrend (private)', () => {
    it('joins revenue/modal/expense/visits/newPatients per month and computes netProfit + margin (positive)', async () => {
      billingRepo.query.mockResolvedValueOnce([
        { month: '2026-01', revenue: '1000000' },
        { month: '2026-02', revenue: '2000000' },
      ]);
      billingItemRepo.query.mockResolvedValueOnce([
        { month: '2026-01', modal: '300000' },
      ]);
      operationalRecordRepo.query.mockResolvedValueOnce([
        { month: '2026-01', expense: '200000' },
      ]);
      encounterRepo.query.mockResolvedValueOnce([
        { month: '2026-01', visits: '15' },
      ]);
      encounterRepo.query.mockResolvedValueOnce([
        { month: '2026-01', newPatients: '4' },
      ]);

      const result = await (service as any).computeMonthlyTrend(1, [
        '2026-01',
        '2026-02',
      ]);

      expect(result[0]).toEqual({
        month: '2026-01',
        revenue: 1000000,
        modal: 300000,
        expense: 200000,
        netProfit: 500000,
        marginPercent: 50,
        visits: 15,
        newPatients: 4,
      });
    });

    it('defaults every field to 0 for a month with no matching rows at all (negative/edge)', async () => {
      billingRepo.query.mockResolvedValueOnce([]);
      billingItemRepo.query.mockResolvedValueOnce([]);
      operationalRecordRepo.query.mockResolvedValueOnce([]);
      encounterRepo.query.mockResolvedValueOnce([]);
      encounterRepo.query.mockResolvedValueOnce([]);

      const result = await (service as any).computeMonthlyTrend(1, ['2026-03']);

      expect(result[0]).toEqual({
        month: '2026-03',
        revenue: 0,
        modal: 0,
        expense: 0,
        netProfit: 0,
        marginPercent: 0,
        visits: 0,
        newPatients: 0,
      });
    });

    it('does not divide by zero for marginPercent when revenue is 0 but expense is not (negative/edge)', async () => {
      billingRepo.query.mockResolvedValueOnce([]);
      billingItemRepo.query.mockResolvedValueOnce([]);
      operationalRecordRepo.query.mockResolvedValueOnce([
        { month: '2026-03', expense: '50000' },
      ]);
      encounterRepo.query.mockResolvedValueOnce([]);
      encounterRepo.query.mockResolvedValueOnce([]);

      const result = await (service as any).computeMonthlyTrend(1, ['2026-03']);

      expect(result[0].netProfit).toBe(-50000);
      expect(result[0].marginPercent).toBe(0);
    });
  });

  describe('computeByDoctorProfit (private)', () => {
    it('nets out modal and doctor fee share per practitioner, sorted by revenue desc (positive)', async () => {
      billingItemRepo.query.mockResolvedValue([
        {
          practitionerId: 1,
          practitionerName: 'Dr. A',
          hargaPokok: '20000',
          hargaJual: '100000',
          qty: '5',
          revenue: '500000',
          feeType: FeeType.PERCENTAGE,
          feeValue: '10',
        },
        {
          practitionerId: 2,
          practitionerName: 'Dr. B',
          hargaPokok: '10000',
          hargaJual: '50000',
          qty: '20',
          revenue: '1000000',
          feeType: FeeType.FIXED,
          feeValue: '5000',
        },
      ]);

      const result = await (service as any).computeByDoctorProfit(
        1,
        '2026-01-01',
        '2026-01-31',
      );

      expect(result[0].practitionerName).toBe('Dr. B'); // higher revenue first
      expect(result[0].doctorFeeShare).toBe(100000); // 20 * 5000
      expect(result[0].labaBersih).toBe(1000000 - 200000 - 100000); // revenue - modal - fee

      expect(result[1].doctorFeeShare).toBe(50000); // 5 * (100000 * 10%)
      expect(result[1].labaBersih).toBe(500000 - 100000 - 50000);
    });

    it('accumulates multiple tarif rows for the same practitioner (positive/edge)', async () => {
      billingItemRepo.query.mockResolvedValue([
        {
          practitionerId: 1,
          practitionerName: 'Dr. A',
          hargaPokok: '10000',
          hargaJual: '50000',
          qty: '2',
          revenue: '100000',
          feeType: FeeType.FIXED,
          feeValue: '1000',
        },
        {
          practitionerId: 1,
          practitionerName: 'Dr. A',
          hargaPokok: '5000',
          hargaJual: '20000',
          qty: '3',
          revenue: '60000',
          feeType: FeeType.FIXED,
          feeValue: '500',
        },
      ]);

      const result = await (service as any).computeByDoctorProfit(
        1,
        '2026-01-01',
        '2026-01-31',
      );

      expect(result).toHaveLength(1);
      expect(result[0].revenue).toBe(160000);
    });

    it('returns an empty array when there is no billing activity (negative/edge)', async () => {
      billingItemRepo.query.mockResolvedValue([]);
      const result = await (service as any).computeByDoctorProfit(
        1,
        '2026-01-01',
        '2026-01-31',
      );
      expect(result).toEqual([]);
    });
  });

  describe('computeVisitHeatmap (private)', () => {
    it('maps day-of-week/hour buckets to parsed integers (positive)', async () => {
      encounterRepo.query.mockResolvedValue([
        { dayOfWeek: '2', hour: '9', count: '5' },
      ]);
      const result = await (service as any).computeVisitHeatmap(
        1,
        '2026-01-01',
        '2026-01-31',
      );
      expect(result).toEqual([{ dayOfWeek: 2, hour: 9, count: 5 }]);
    });

    it('returns an empty array when there are no visits in the period (negative/edge)', async () => {
      encounterRepo.query.mockResolvedValue([]);
      const result = await (service as any).computeVisitHeatmap(
        1,
        '2026-01-01',
        '2026-01-31',
      );
      expect(result).toEqual([]);
    });
  });

  describe('computeStockReport (private)', () => {
    it('reports total inventory value and top material usage by cost (positive)', async () => {
      barangRepo.query.mockResolvedValue([{ totalValue: '5000000', totalItems: '20' }]);
      stokTransaksiRepo.query.mockResolvedValue([
        { barangId: 1, barangName: 'Kapas', satuan: 'box', qtyUsed: '10', totalCost: '100000' },
      ]);

      const result = await (service as any).computeStockReport(
        1,
        '2026-01-01',
        '2026-01-31',
      );

      expect(result.totalInventoryValue).toBe(5000000);
      expect(result.totalActiveItems).toBe(20);
      expect(result.usage[0]).toEqual({
        barangId: 1,
        barangName: 'Kapas',
        satuan: 'box',
        qtyUsed: 10,
        totalCost: 100000,
      });
    });

    it('defaults to zero inventory value when the clinic has no active barang (negative/edge)', async () => {
      barangRepo.query.mockResolvedValue([{ totalValue: null, totalItems: '0' }]);
      stokTransaksiRepo.query.mockResolvedValue([]);

      const result = await (service as any).computeStockReport(
        1,
        '2026-01-01',
        '2026-01-31',
      );

      expect(result.totalInventoryValue).toBe(0);
      expect(result.usage).toEqual([]);
    });
  });

  describe('geocodeKecamatan (private)', () => {
    beforeEach(() => {
      global.fetch = jest.fn() as any;
    });

    it('returns the cached row without calling Nominatim when already geocoded (positive)', async () => {
      const cached = { id: 1, kecamatan: 'A', city: 'B', lat: 1, lng: 2, resolved: true };
      patientOriginGeocodeRepo.findOne.mockResolvedValue(cached);

      const result = await (service as any).geocodeKecamatan('A', 'B');

      expect(result).toBe(cached);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('geocodes via Nominatim and caches the resolved coordinates (positive)', async () => {
      patientOriginGeocodeRepo.findOne.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [{ lat: '-6.2', lon: '106.8' }],
      });

      const result = await (service as any).geocodeKecamatan('Menteng', 'Jakarta');

      expect(result.resolved).toBe(true);
      expect(result.lat).toBeCloseTo(-6.2);
      expect(result.lng).toBeCloseTo(106.8);
      expect(patientOriginGeocodeRepo.save).toHaveBeenCalled();
    });

    it('caches an unresolved record (not an error) when Nominatim returns no match (negative/edge)', async () => {
      patientOriginGeocodeRepo.findOne.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      const result = await (service as any).geocodeKecamatan('Unknown', 'Nowhere');

      expect(result.resolved).toBe(false);
      expect(result.lat).toBeNull();
    });

    it('caches an unresolved record instead of throwing when the fetch fails (negative)', async () => {
      patientOriginGeocodeRepo.findOne.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockRejectedValue(new Error('network down'));

      const result = await (service as any).geocodeKecamatan('X', 'Y');

      expect(result.resolved).toBe(false);
      expect(patientOriginGeocodeRepo.save).toHaveBeenCalled();
    });

    it('caches an unresolved record when Nominatim responds with a non-OK status (negative/edge)', async () => {
      patientOriginGeocodeRepo.findOne.mockResolvedValue(null);
      (global.fetch as jest.Mock).mockResolvedValue({ ok: false });

      const result = await (service as any).geocodeKecamatan('X', 'Y');

      expect(result.resolved).toBe(false);
    });
  });

  describe('getPatientOriginMap', () => {
    beforeEach(() => {
      jest.useFakeTimers({ advanceTimers: true });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('reuses cached geocodes without calling Nominatim (positive)', async () => {
      patientRepo.query.mockResolvedValue([
        { kecamatan: 'Menteng', city: 'Jakarta', count: '5' },
      ]);
      patientOriginGeocodeRepo.findOne.mockResolvedValue({
        lat: -6.2,
        lng: 106.8,
        resolved: true,
      });
      const geocodeSpy = jest.spyOn(service as any, 'geocodeKecamatan');

      const result = await service.getPatientOriginMap(1);

      expect(result.data).toEqual([
        { kecamatan: 'Menteng', city: 'Jakarta', count: 5, lat: -6.2, lng: 106.8, resolved: true },
      ]);
      expect(geocodeSpy).not.toHaveBeenCalled();
    });

    it('geocodes an uncached kecamatan via the (mocked) geocode step (positive)', async () => {
      patientRepo.query.mockResolvedValue([
        { kecamatan: 'Menteng', city: 'Jakarta', count: '3' },
      ]);
      patientOriginGeocodeRepo.findOne.mockResolvedValue(null);
      const geocodeSpy = jest
        .spyOn(service as any, 'geocodeKecamatan')
        .mockResolvedValue({ lat: -6.2, lng: 106.8, resolved: true });

      const result = await service.getPatientOriginMap(1);

      expect(geocodeSpy).toHaveBeenCalledWith('Menteng', 'Jakarta');
      expect(result.data[0].resolved).toBe(true);
    });

    it('caps geocoding at 15 new lookups per request, leaving the rest unresolved (negative/edge)', async () => {
      const rows = Array.from({ length: 17 }, (_, i) => ({
        kecamatan: `Kec${i}`,
        city: 'Kota',
        count: String(20 - i),
      }));
      patientRepo.query.mockResolvedValue(rows);
      patientOriginGeocodeRepo.findOne.mockResolvedValue(null);
      const geocodeSpy = jest
        .spyOn(service as any, 'geocodeKecamatan')
        .mockResolvedValue({ lat: 0, lng: 0, resolved: true });

      const promise = service.getPatientOriginMap(1);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(geocodeSpy).toHaveBeenCalledTimes(15);
      const unresolved = result.data.filter((p) => !p.resolved);
      expect(unresolved).toHaveLength(2);
    }, 15000);

    it('returns an empty list when the clinic has no patients with a recorded kecamatan (negative/edge)', async () => {
      patientRepo.query.mockResolvedValue([]);
      const result = await service.getPatientOriginMap(1);
      expect(result.data).toEqual([]);
    });
  });

  describe('getPatientOriginByKelurahan', () => {
    it('aggregates patient counts by kelurahan without geocoding (positive)', async () => {
      patientRepo.query.mockResolvedValue([
        { kelurahan: 'Balai Nan Duo', kecamatan: 'Payakumbuh Barat', city: 'Kota Payakumbuh', count: '9' },
        { kelurahan: 'Sungai Durian', kecamatan: 'Payakumbuh Utara', city: 'Kota Payakumbuh', count: '4' },
      ]);

      const result = await service.getPatientOriginByKelurahan(1);

      expect(result.data).toEqual([
        { kelurahan: 'Balai Nan Duo', kecamatan: 'Payakumbuh Barat', city: 'Kota Payakumbuh', count: 9 },
        { kelurahan: 'Sungai Durian', kecamatan: 'Payakumbuh Utara', city: 'Kota Payakumbuh', count: 4 },
      ]);
    });

    it('scopes the query to the given clinic and excludes blank kelurahan (positive)', async () => {
      patientRepo.query.mockResolvedValue([]);
      await service.getPatientOriginByKelurahan(7);
      expect(patientRepo.query).toHaveBeenCalledWith(
        expect.stringContaining("kelurahan IS NOT NULL AND kelurahan != ''"),
        [7],
      );
    });

    it('returns an empty list when the clinic has no patients with a recorded kelurahan (negative/edge)', async () => {
      patientRepo.query.mockResolvedValue([]);
      const result = await service.getPatientOriginByKelurahan(1);
      expect(result.data).toEqual([]);
    });
  });

  describe('getVisitReport', () => {
    const dokter = { userId: 2, role: UserRole.DOKTER };
    const admin = { userId: 1, role: UserRole.ADMIN };

    function mockAllQueries(overrides: any[] = []) {
      const defaults = [
        [{ total: '10', finished: '6', cancelled: '2', inProgress: '2', avgDuration: '45.6' }], // 1 summary
        [{ date: '2026-01-01', count: '10' }], // 2 byDay
        [{ practitionerName: 'Dr. A', count: '10' }], // 3 byDoctor
        [{ gender: 'male', count: '6' }, { gender: 'female', count: '4' }], // 4 byGender
        [{ ageGroup: '26-40 (Dewasa)', count: '10' }], // 5 byAgeGroupRaw
        [{ patientType: 'new', count: '3' }, { patientType: 'returning', count: '7' }], // 6 newVsReturningRaw
        [{ tindakan: 'Tambal', kategori: 'Konservasi', count: '8' }, { tindakan: 'Cabut', kategori: 'Bedah', count: '2' }], // 7 procedureRows
        [{ hour: '9', count: '5' }, { hour: '10', count: '5' }], // 8 byHourRaw
        [{ dow: '2', count: '10' }], // 9 byDayOfWeekRaw
        [{ total: '8' }], // 10 prevSummaryRow
      ];
      const seq = defaults.map((d, i) => overrides[i] ?? d);
      seq.forEach((r) => encounterRepo.query.mockResolvedValueOnce(r));
    }

    it('aggregates summary, demographics, procedure mix and time patterns (positive)', async () => {
      const qb = buildQb({
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 1,
              status: 'finished',
              arrivedTime: new Date('2026-01-01T09:00:00Z'),
              inProgressTime: new Date('2026-01-01T09:10:00Z'),
              finishedTime: new Date('2026-01-01T09:40:00Z'),
              patient: { name: 'Budi' },
              practitioner: { name: 'Dr. A' },
            },
          ],
          1,
        ]),
      });
      encounterRepo.createQueryBuilder.mockReturnValue(qb);
      mockAllQueries();

      const result = await service.getVisitReport(
        1,
        { dateFrom: '2026-01-01', dateTo: '2026-01-07' } as any,
        admin,
      );

      expect(result.data.summary).toEqual({
        total: 10,
        finished: 6,
        cancelled: 2,
        inProgress: 2,
        avgDurationMinutes: 46,
      });
      expect(result.data.demographics.newVsReturning).toEqual({ new: 3, returning: 7 });
      expect(result.data.demographics.byAgeGroup).toEqual([
        { group: '26-40 (Dewasa)', count: 10 },
      ]);
      expect(result.data.procedureMix.byKategori).toEqual([
        { kategori: 'Konservasi', count: 8 },
        { kategori: 'Bedah', count: 2 },
      ]);
      expect(result.data.procedureMix.avgProceduresPerVisit).toBe(1); // 10 procedures / 10 total
      expect(result.data.byHour.find((h: any) => h.hour === 9)?.count).toBe(5);
      expect(result.data.byHour.find((h: any) => h.hour === 3)?.count).toBe(0);
      expect(result.data.byDayOfWeek.find((d: any) => d.day === 'Senin')?.count).toBe(10);
      expect(result.data.comparison).toEqual({ previousTotal: 8, changePercent: 25 });
      expect(result.data.encounters[0].durationMinutes).toBe(30);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 50, totalPages: 1 });
    });

    it('reports avgDurationMinutes as null (not 0) when no encounter has both timestamps (negative/edge)', async () => {
      mockAllQueries([
        [{ total: '5', finished: '0', cancelled: '0', inProgress: '5', avgDuration: null }],
      ]);
      const result = await service.getVisitReport(
        1,
        { dateFrom: '2026-01-01', dateTo: '2026-01-07' } as any,
        admin,
      );
      expect(result.data.summary.avgDurationMinutes).toBeNull();
    });

    it('reports changePercent as null (not 0 or Infinity) when the previous period had zero visits (negative/edge)', async () => {
      mockAllQueries([, , , , , , , , , [{ total: '0' }]]);
      const result = await service.getVisitReport(
        1,
        { dateFrom: '2026-01-01', dateTo: '2026-01-07' } as any,
        admin,
      );
      expect(result.data.comparison.changePercent).toBeNull();
    });

    it('reports avgProceduresPerVisit as 0 instead of dividing by zero when there were no visits (negative/edge)', async () => {
      mockAllQueries([
        [{ total: '0', finished: '0', cancelled: '0', inProgress: '0', avgDuration: null }],
      ]);
      const result = await service.getVisitReport(
        1,
        { dateFrom: '2026-01-01', dateTo: '2026-01-07' } as any,
        admin,
      );
      expect(result.data.procedureMix.avgProceduresPerVisit).toBe(0);
    });

    it('scopes a DOKTER to only their own encounters via a subquery filter (positive)', async () => {
      const qb = buildQb();
      encounterRepo.createQueryBuilder.mockReturnValue(qb);
      mockAllQueries();

      await service.getVisitReport(
        1,
        { dateFrom: '2026-01-01', dateTo: '2026-01-07' } as any,
        dokter,
      );

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('practitioners WHERE user_id'),
        { uid: dokter.userId },
      );
    });

    it('filters by practitionerId for a non-DOKTER caller when provided (positive)', async () => {
      const qb = buildQb();
      encounterRepo.createQueryBuilder.mockReturnValue(qb);
      mockAllQueries();

      await service.getVisitReport(
        1,
        { dateFrom: '2026-01-01', dateTo: '2026-01-07', practitionerId: 9 } as any,
        admin,
      );

      expect(qb.andWhere).toHaveBeenCalledWith('e.practitionerId = :pid', { pid: 9 });
    });
  });

  describe('getFinancialReport', () => {
    function mockDirectQueries(overrides: {
      summaryRow?: any[];
      byDay?: any[];
      byPaymentMethod?: any[];
      byDoctorRevenue?: any[];
      shareRows?: any[];
      tindakanRows?: any[];
      pengeluaranRow?: any[];
      prevSummaryRow?: any[];
    } = {}) {
      billingRepo.query
        .mockResolvedValueOnce(
          overrides.summaryRow ?? [
            {
              totalBilling: '1000000',
              totalPaid: '800000',
              totalOutstanding: '200000',
              totalRefunded: '0',
              totalBillings: '10',
            },
          ],
        )
        .mockResolvedValueOnce(overrides.byDay ?? [])
        .mockResolvedValueOnce(overrides.byDoctorRevenue ?? [])
        .mockResolvedValueOnce(overrides.prevSummaryRow ?? [{ totalPaid: '0' }]);
      paymentRepo.query.mockResolvedValueOnce(overrides.byPaymentMethod ?? []);
      billingItemRepo.query
        .mockResolvedValueOnce(overrides.shareRows ?? [])
        .mockResolvedValueOnce(overrides.tindakanRows ?? []);
      operationalRecordRepo.query.mockResolvedValueOnce(overrides.pengeluaranRow ?? [{ total: '0' }]);
    }

    let businessMetricsSpy: jest.SpyInstance;
    beforeEach(() => {
      businessMetricsSpy = jest
        .spyOn(service as any, 'computeBusinessMetrics')
        .mockResolvedValue({ ltv: {}, arpv: 0, pareto: {}, dso: {}, retention: {}, categoryProfitability: [], marketing: {} });
    });

    it('computes the financial summary and collection rate (positive)', async () => {
      mockDirectQueries();

      const result = await service.getFinancialReport(1, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      } as any);

      expect(result.data.summary).toEqual({
        totalBilling: 1000000,
        totalPaid: 800000,
        totalOutstanding: 200000,
        collectionRate: 80,
        totalRefunded: 0,
      });
      expect(businessMetricsSpy).toHaveBeenCalledWith(1, '2026-01-01', '2026-01-31');
    });

    it('reports collectionRate as 0 instead of NaN when there is no billing at all (negative/edge)', async () => {
      mockDirectQueries({
        summaryRow: [
          { totalBilling: null, totalPaid: null, totalOutstanding: null, totalRefunded: null, totalBillings: '0' },
        ],
      });

      const result = await service.getFinancialReport(1, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      } as any);

      expect(result.data.summary.collectionRate).toBe(0);
    });

    it('attributes doctor-fee share correctly to byDoctor revenue rows (positive)', async () => {
      mockDirectQueries({
        byDoctorRevenue: [{ practitionerId: 1, practitionerName: 'Dr. A', revenue: '500000' }],
        shareRows: [
          {
            practitionerId: 1,
            tarifId: 5,
            hargaJual: '100000',
            count: '2',
            feeType: FeeType.FIXED,
            feeValue: '10000',
          },
        ],
      });

      const result = await service.getFinancialReport(1, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      } as any);

      expect(result.data.byDoctor[0]).toEqual({
        practitionerName: 'Dr. A',
        revenue: 500000,
        doctorFeeShare: 20000,
      });
    });

    it('computes modal, labaBersih and marginPersen from tindakanTerlaris + pengeluaran (positive)', async () => {
      mockDirectQueries({
        summaryRow: [
          { totalBilling: '1000000', totalPaid: '1000000', totalOutstanding: '0', totalRefunded: '0', totalBillings: '5' },
        ],
        tindakanRows: [
          {
            tarifId: 1,
            tarifName: 'Tambal',
            hargaPokok: '20000',
            hargaJual: '100000',
            frekuensi: '10',
            totalDiskon: '5000',
            totalSubtotal: '950000',
          },
        ],
        pengeluaranRow: [{ total: '100000' }],
      });

      const result = await service.getFinancialReport(1, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      } as any);

      // modal = 20000 * 10 = 200000; labaBersih = 1,000,000(paid) - 200,000(modal) - 100,000(pengeluaran)
      expect(result.data.ringkasan.modal).toBe(200000);
      expect(result.data.ringkasan.labaBersih).toBe(700000);
      expect(result.data.ringkasan.marginPersen).toBe(70);
      expect(result.data.tindakanTerlaris[0].labaBersih).toBe(950000 - 200000);
    });

    it('reports changePercent as null when the previous period had no revenue (negative/edge)', async () => {
      mockDirectQueries({ prevSummaryRow: [{ totalPaid: null }] });
      const result = await service.getFinancialReport(1, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      } as any);
      expect(result.data.comparison.changePercent).toBeNull();
    });

    it('computes a positive changePercent against a nonzero previous period (positive)', async () => {
      mockDirectQueries({
        summaryRow: [
          { totalBilling: '1200000', totalPaid: '1200000', totalOutstanding: '0', totalRefunded: '0', totalBillings: '5' },
        ],
        prevSummaryRow: [{ totalPaid: '1000000' }],
      });
      const result = await service.getFinancialReport(1, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      } as any);
      expect(result.data.comparison.changePercent).toBe(20);
    });
  });

  describe('getFinancialReportPro', () => {
    it('combines the base financial report with Pro-only sections and computes labaKotor (positive)', async () => {
      const baseReport = {
        data: {
          summary: { totalBilling: 1000000, totalPaid: 900000, totalOutstanding: 100000, collectionRate: 90, totalRefunded: 0 },
          comparison: { previousPendapatan: 0, changePercent: null },
          byDay: [],
          byPaymentMethod: [],
          byDoctor: [],
          ringkasan: { pendapatanTotal: 900000, modal: 300000, labaBersih: 500000, pengeluaran: 100000, marginPersen: 55.6 },
          tindakanTerlaris: [
            { tarifId: 1, namaTindakan: 'A', modal: 1000, hargaJual: 2000, frekuensi: 5, totalDiskon: 5000, labaBersih: 4000 },
            { tarifId: 2, namaTindakan: 'B', modal: 500, hargaJual: 1000, frekuensi: 2, totalDiskon: 10000, labaBersih: 1000 },
          ],
          businessMetrics: {},
        },
      };
      const getFinancialReportSpy = jest
        .spyOn(service, 'getFinancialReport')
        .mockResolvedValue(baseReport as any);
      const monthlyTrendSpy = jest
        .spyOn(service as any, 'computeMonthlyTrend')
        .mockResolvedValue([{ month: '2026-01', revenue: 100, modal: 10, expense: 5, netProfit: 85, marginPercent: 85, visits: 1, newPatients: 1 }]);
      const byDoctorProfitSpy = jest
        .spyOn(service as any, 'computeByDoctorProfit')
        .mockResolvedValue([{ practitionerName: 'Dr. A', revenue: 100, doctorFeeShare: 10, labaBersih: 90 }]);
      const heatmapSpy = jest
        .spyOn(service as any, 'computeVisitHeatmap')
        .mockResolvedValue([{ dayOfWeek: 2, hour: 9, count: 3 }]);
      const stockSpy = jest
        .spyOn(service as any, 'computeStockReport')
        .mockResolvedValue({ totalInventoryValue: 1000, totalActiveItems: 5, usage: [] });

      const result = await service.getFinancialReportPro(1, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      } as any);

      expect(getFinancialReportSpy).toHaveBeenCalledWith(1, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });
      expect(result.data.labaKotor).toBe(900000 - 300000); // totalPaid - modal
      expect(result.data.monthlyTrend).toEqual([
        { month: '2026-01', revenue: 100, modal: 10, expense: 5, netProfit: 85, marginPercent: 85, visits: 1, newPatients: 1 },
      ]);
      expect(result.data.byDoctorProfit[0].practitionerName).toBe('Dr. A');
      expect(result.data.visitHeatmap[0].count).toBe(3);
      expect(result.data.stockReport.totalActiveItems).toBe(5);
      // discount ranking: only positive-discount items, sorted desc by discount
      expect(result.data.discountRanking.map((t: any) => t.tarifId)).toEqual([2, 1]);
    });

    it('excludes zero-discount tindakan from discountRanking (negative/edge)', async () => {
      const baseReport = {
        data: {
          summary: {}, comparison: {}, byDay: [], byPaymentMethod: [], byDoctor: [],
          ringkasan: { modal: 0 },
          tindakanTerlaris: [
            { tarifId: 1, namaTindakan: 'A', modal: 0, hargaJual: 0, frekuensi: 0, totalDiskon: 0, labaBersih: 0 },
          ],
          businessMetrics: {},
        },
      };
      jest.spyOn(service, 'getFinancialReport').mockResolvedValue(baseReport as any);
      jest.spyOn(service as any, 'computeMonthlyTrend').mockResolvedValue([]);
      jest.spyOn(service as any, 'computeByDoctorProfit').mockResolvedValue([]);
      jest.spyOn(service as any, 'computeVisitHeatmap').mockResolvedValue([]);
      jest.spyOn(service as any, 'computeStockReport').mockResolvedValue({ totalInventoryValue: 0, totalActiveItems: 0, usage: [] });

      const result = await service.getFinancialReportPro(1, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      } as any);

      expect(result.data.discountRanking).toEqual([]);
    });
  });

  describe('getInvestorReportData', () => {
    it('assembles 12-month totals, growth%, retention% and top doctors (positive)', async () => {
      const monthly = [
        { month: '2025-08', revenue: 1000000, modal: 200000, expense: 100000, netProfit: 700000, marginPercent: 70, visits: 10, newPatients: 2 },
        { month: '2025-09', revenue: 1000000, modal: 200000, expense: 100000, netProfit: 700000, marginPercent: 70, visits: 10, newPatients: 2 },
        { month: '2025-10', revenue: 1000000, modal: 200000, expense: 100000, netProfit: 700000, marginPercent: 70, visits: 10, newPatients: 2 },
        { month: '2025-11', revenue: 1000000, modal: 200000, expense: 100000, netProfit: 700000, marginPercent: 70, visits: 10, newPatients: 2 },
        { month: '2025-12', revenue: 1000000, modal: 200000, expense: 100000, netProfit: 700000, marginPercent: 70, visits: 10, newPatients: 2 },
        { month: '2026-01', revenue: 1000000, modal: 200000, expense: 100000, netProfit: 700000, marginPercent: 70, visits: 10, newPatients: 2 },
        { month: '2026-02', revenue: 2000000, modal: 200000, expense: 100000, netProfit: 1700000, marginPercent: 85, visits: 20, newPatients: 4 },
        { month: '2026-03', revenue: 2000000, modal: 200000, expense: 100000, netProfit: 1700000, marginPercent: 85, visits: 20, newPatients: 4 },
        { month: '2026-04', revenue: 2000000, modal: 200000, expense: 100000, netProfit: 1700000, marginPercent: 85, visits: 20, newPatients: 4 },
        { month: '2026-05', revenue: 2000000, modal: 200000, expense: 100000, netProfit: 1700000, marginPercent: 85, visits: 20, newPatients: 4 },
        { month: '2026-06', revenue: 2000000, modal: 200000, expense: 100000, netProfit: 1700000, marginPercent: 85, visits: 20, newPatients: 4 },
        { month: '2026-07', revenue: 2000000, modal: 200000, expense: 100000, netProfit: 1700000, marginPercent: 85, visits: 20, newPatients: 4 },
      ];
      jest.spyOn(service as any, 'computeMonthlyTrend').mockResolvedValue(monthly);
      jest.spyOn(service as any, 'computeLtv').mockResolvedValue({ averageLtv: 500000, averageVisitsPerPatient: 2, patientCount: 50 });
      jest.spyOn(service as any, 'computeDso').mockResolvedValue({ averageDays: 10, outstandingCount: 3 });
      jest.spyOn(service as any, 'computeArpv').mockResolvedValue(150000);
      jest.spyOn(service as any, 'computeCategoryProfitability').mockResolvedValue([]);
      jest.spyOn(service as any, 'computeMarketingMetrics').mockResolvedValue({ totalAdSpend: 0, newPatients: 0, cac: null, ltvCacRatio: null });

      encounterRepo.query.mockResolvedValueOnce([{ total: '80' }]); // totalPatientsRow
      billingRepo.query
        .mockResolvedValueOnce([{ prevPatients: '20', returningPatients: '15' }]) // halfYearRetentionRow
        .mockResolvedValueOnce([{ practitionerId: 1, practitionerName: 'Dr. A', revenue: '5000000' }]); // byDoctorRevenue

      const result = await service.getInvestorReportData(1);

      expect(result.summary.totalRevenue12mo).toBe(18000000);
      expect(result.summary.totalVisits12mo).toBe(180);
      expect(result.summary.avgMonthlyRevenue).toBe(18000000 / 12);
      // last3 (2026-05,06,07 = 6,000,000) vs prior3 (2026-02,03,04 = 6,000,000) -> 0% growth
      expect(result.summary.recentGrowthPercent).toBe(0);
      expect(result.unitEconomics.halfYearRetentionPercent).toBe(75); // 15/20
      expect(result.byDoctor[0]).toEqual({ practitionerName: 'Dr. A', revenue: 5000000 });
      const realMonthKeys = (service as any).getTrailingMonthKeys(12);
      expect(result.periodStart).toBe(realMonthKeys[0]);
      expect(result.periodEnd).toBe(realMonthKeys[11]);
    });

    it('reports recentGrowthPercent as null (not 0) when the prior-3-month baseline is zero (negative/edge)', async () => {
      const monthly = Array.from({ length: 12 }, (_, i) => ({
        month: `m${i}`,
        revenue: i >= 9 ? 1000 : 0,
        modal: 0,
        expense: 0,
        netProfit: 0,
        marginPercent: 0,
        visits: 0,
        newPatients: 0,
      }));
      jest.spyOn(service as any, 'computeMonthlyTrend').mockResolvedValue(monthly);
      jest.spyOn(service as any, 'computeLtv').mockResolvedValue({ averageLtv: 0, averageVisitsPerPatient: 0, patientCount: 0 });
      jest.spyOn(service as any, 'computeDso').mockResolvedValue({ averageDays: 0, outstandingCount: 0 });
      jest.spyOn(service as any, 'computeArpv').mockResolvedValue(0);
      jest.spyOn(service as any, 'computeCategoryProfitability').mockResolvedValue([]);
      jest.spyOn(service as any, 'computeMarketingMetrics').mockResolvedValue({ totalAdSpend: 0, newPatients: 0, cac: null, ltvCacRatio: null });
      encounterRepo.query.mockResolvedValueOnce([{ total: '0' }]);
      billingRepo.query
        .mockResolvedValueOnce([{ prevPatients: '0', returningPatients: '0' }])
        .mockResolvedValueOnce([]);

      const result = await service.getInvestorReportData(1);

      expect(result.summary.recentGrowthPercent).toBe(null);
    });

    it('reports halfYearRetentionPercent as null when there were no patients in the first half (negative/edge)', async () => {
      jest.spyOn(service as any, 'computeMonthlyTrend').mockResolvedValue(
        Array.from({ length: 12 }, (_, i) => ({
          month: `m${i}`, revenue: 0, modal: 0, expense: 0, netProfit: 0, marginPercent: 0, visits: 0, newPatients: 0,
        })),
      );
      jest.spyOn(service as any, 'computeLtv').mockResolvedValue({ averageLtv: 0, averageVisitsPerPatient: 0, patientCount: 0 });
      jest.spyOn(service as any, 'computeDso').mockResolvedValue({ averageDays: 0, outstandingCount: 0 });
      jest.spyOn(service as any, 'computeArpv').mockResolvedValue(0);
      jest.spyOn(service as any, 'computeCategoryProfitability').mockResolvedValue([]);
      jest.spyOn(service as any, 'computeMarketingMetrics').mockResolvedValue({ totalAdSpend: 0, newPatients: 0, cac: null, ltvCacRatio: null });
      encounterRepo.query.mockResolvedValueOnce([{ total: '0' }]);
      billingRepo.query
        .mockResolvedValueOnce([{ prevPatients: '0', returningPatients: '0' }])
        .mockResolvedValueOnce([]);

      const result = await service.getInvestorReportData(1);

      expect(result.unitEconomics.halfYearRetentionPercent).toBeNull();
    });
  });

  describe('getFinancialVisitDetail', () => {
    it('paginates visit rows with a joined tindakan summary (positive)', async () => {
      encounterRepo.query
        .mockResolvedValueOnce([
          {
            encounterId: 1,
            patientName: 'Budi',
            birthDate: '2000-01-01',
            tindakan: 'Tambal, Cabut',
            jamMasuk: new Date('2026-01-01T09:00:00Z'),
            jamKeluar: new Date('2026-01-01T09:30:00Z'),
          },
        ])
        .mockResolvedValueOnce([{ total: '1' }]);

      const result = await service.getFinancialVisitDetail(1, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      } as any);

      expect(result.data.data[0].tindakan).toBe('Tambal, Cabut');
      expect(result.data.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('falls back to "-" when an encounter has no billed tindakan yet (negative/edge)', async () => {
      encounterRepo.query
        .mockResolvedValueOnce([
          {
            encounterId: 1,
            patientName: 'Budi',
            birthDate: '2000-01-01',
            tindakan: null,
            jamMasuk: new Date(),
            jamKeluar: null,
          },
        ])
        .mockResolvedValueOnce([{ total: '1' }]);

      const result = await service.getFinancialVisitDetail(1, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      } as any);

      expect(result.data.data[0].tindakan).toBe('-');
    });

    it('applies pagination offset based on page/limit (positive)', async () => {
      encounterRepo.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: '0' }]);

      await service.getFinancialVisitDetail(1, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
        page: 3,
        limit: 10,
      } as any);

      expect(encounterRepo.query).toHaveBeenCalledWith(
        expect.any(String),
        [1, '2026-01-01', '2026-01-31', 10, 20], // limit=10, offset=(3-1)*10=20
      );
    });

    it('returns an empty page (not an error) when nothing matches the date range (negative/edge)', async () => {
      encounterRepo.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: '0' }]);

      const result = await service.getFinancialVisitDetail(1, {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      } as any);

      expect(result.data.data).toEqual([]);
      expect(result.data.meta.total).toBe(0);
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
