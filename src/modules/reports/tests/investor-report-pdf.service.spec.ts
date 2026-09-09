import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

const createPdfMock = jest.fn();

jest.mock('pdfmake', () => ({
  setFonts: jest.fn(),
  setLocalAccessPolicy: jest.fn(),
  setUrlAccessPolicy: jest.fn(),
  createPdf: (...args: any[]) => createPdfMock(...args),
}));

import { InvestorReportPdfService } from '../investor-report-pdf.service';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { ReportsService } from '../reports.service';

function baseInvestorData(overrides: Partial<Record<string, any>> = {}) {
  return {
    generatedAt: new Date('2026-01-15').toISOString(),
    periodStart: '2025-02',
    periodEnd: '2026-01',
    summary: {
      totalRevenue12mo: 120000000,
      avgMonthlyRevenue: 10000000,
      recentGrowthPercent: 12.5,
      avgMarginPercent: 35,
      totalPatients12mo: 200,
      totalVisits12mo: 500,
      totalNewPatients12mo: 40,
      totalNetProfit12mo: 42000000,
    },
    unitEconomics: {
      ltv: { averageLtv: 600000, averageVisitsPerPatient: 2.5 },
      arpv: 240000,
      halfYearRetentionPercent: 65,
      dso: { averageDays: 12 },
      marketing: { cac: 50000, ltvCacRatio: 12 },
    },
    monthly: [
      { month: '2026-01', revenue: 10000000, modal: 3000000, expense: 2000000, netProfit: 5000000, marginPercent: 50, visits: 40 },
    ],
    categoryProfitability: [
      { kategori: 'Konservasi', frekuensi: 20, pendapatan: 5000000, labaBersih: 2000000, marginPersen: 40 },
    ],
    byDoctor: [{ practitionerName: 'Dr. A', revenue: 30000000 }],
    ...overrides,
  };
}

describe('InvestorReportPdfService', () => {
  let service: InvestorReportPdfService;
  let clinicRepo: { findOne: jest.Mock };
  let reportsService: { getInvestorReportData: jest.Mock };

  beforeEach(async () => {
    createPdfMock.mockClear();
    createPdfMock.mockReturnValue({
      getBuffer: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
    });
    clinicRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Klinik A' }) };
    reportsService = { getInvestorReportData: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvestorReportPdfService,
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: ReportsService, useValue: reportsService },
      ],
    }).compile();

    service = module.get<InvestorReportPdfService>(InvestorReportPdfService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('generates a PDF buffer for a healthy clinic (positive)', async () => {
    reportsService.getInvestorReportData.mockResolvedValue(baseInvestorData());
    const result = await service.generate(1);
    expect(result).toBeInstanceOf(Buffer);
  });

  it('describes revenue as declining when recentGrowthPercent is negative (positive)', async () => {
    reportsService.getInvestorReportData.mockResolvedValue(
      baseInvestorData({
        summary: { ...baseInvestorData().summary, recentGrowthPercent: -8 },
      }),
    );

    await service.generate(1);

    const doc = createPdfMock.mock.calls[0][0];
    expect(JSON.stringify(doc)).toContain('turun 8%');
  });

  it('flags growth as not-yet-computable when recentGrowthPercent is null (negative/edge)', async () => {
    reportsService.getInvestorReportData.mockResolvedValue(
      baseInvestorData({
        summary: { ...baseInvestorData().summary, recentGrowthPercent: null },
      }),
    );

    await service.generate(1);

    const doc = createPdfMock.mock.calls[0][0];
    expect(JSON.stringify(doc)).toContain('belum dapat dihitung (data pembanding belum cukup)');
  });

  it('flags retention as not-yet-computable when halfYearRetentionPercent is null (negative/edge)', async () => {
    reportsService.getInvestorReportData.mockResolvedValue(
      baseInvestorData({
        unitEconomics: {
          ...baseInvestorData().unitEconomics,
          halfYearRetentionPercent: null,
        },
      }),
    );

    await service.generate(1);

    const doc = createPdfMock.mock.calls[0][0];
    expect(JSON.stringify(doc)).toContain('belum dapat dihitung');
  });

  it('omits the CAC sentence and shows "Belum ada data" when CAC is null (negative/edge)', async () => {
    reportsService.getInvestorReportData.mockResolvedValue(
      baseInvestorData({
        unitEconomics: {
          ...baseInvestorData().unitEconomics,
          marketing: { cac: null, ltvCacRatio: null },
        },
      }),
    );

    await service.generate(1);

    const doc = createPdfMock.mock.calls[0][0];
    const serialized = JSON.stringify(doc);
    expect(serialized).not.toContain('Biaya akuisisi pasien baru');
    expect(serialized).toContain('Belum ada data');
  });

  it('describes thin margins with a cautionary narrative below 10% (negative/edge)', async () => {
    reportsService.getInvestorReportData.mockResolvedValue(
      baseInvestorData({
        summary: { ...baseInvestorData().summary, avgMarginPercent: 5 },
      }),
    );

    await service.generate(1);

    const doc = createPdfMock.mock.calls[0][0];
    expect(JSON.stringify(doc)).toContain('masih tipis dan memerlukan perhatian');
  });

  it('renders a fallback row when there is no category profitability data yet (negative/edge)', async () => {
    reportsService.getInvestorReportData.mockResolvedValue(
      baseInvestorData({ categoryProfitability: [] }),
    );

    await service.generate(1);

    const doc = createPdfMock.mock.calls[0][0];
    expect(JSON.stringify(doc)).toContain('Belum ada data tindakan pada periode ini');
  });

  it('renders a fallback row when there is no doctor revenue data yet (negative/edge)', async () => {
    reportsService.getInvestorReportData.mockResolvedValue(
      baseInvestorData({ byDoctor: [] }),
    );

    await service.generate(1);

    const doc = createPdfMock.mock.calls[0][0];
    expect(JSON.stringify(doc)).toContain('Belum ada data dokter pada periode ini');
  });

  it('falls back to a generic clinic name when the clinic record is missing (negative/edge)', async () => {
    clinicRepo.findOne.mockResolvedValue(null);
    reportsService.getInvestorReportData.mockResolvedValue(baseInvestorData());

    await service.generate(1);

    const doc = createPdfMock.mock.calls[0][0];
    expect(doc.content[0].stack[0].text).toBe('Klinik');
  });
});
