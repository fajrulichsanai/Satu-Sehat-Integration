import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

const createPdfMock = jest.fn();

jest.mock('pdfmake', () => ({
  setFonts: jest.fn(),
  setLocalAccessPolicy: jest.fn(),
  setUrlAccessPolicy: jest.fn(),
  createPdf: (...args: any[]) => createPdfMock(...args),
}));

import { FinancialReportPdfService } from '../financial-report-pdf.service';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { ReportsService } from '../reports.service';

function baseFinancialData(overrides: Partial<Record<string, any>> = {}) {
  return {
    summary: { totalPaid: 10000000, totalOutstanding: 500000 },
    ringkasan: { pengeluaran: 3000000, labaBersih: 6500000, marginPersen: 65 },
    labaKotor: 9500000,
    monthlyTrend: [
      { month: '2026-01', revenue: 10000000, expense: 3000000, netProfit: 6500000 },
    ],
    tindakanTerlaris: [
      { namaTindakan: 'Tambal', frekuensi: 10, modal: 500000, totalDiskon: 0, labaBersih: 4500000 },
    ],
    byDoctorProfit: [
      { practitionerName: 'Dr. A', revenue: 5000000, doctorFeeShare: 1000000, labaBersih: 4000000 },
    ],
    stockReport: {
      totalInventoryValue: 2000000,
      totalActiveItems: 15,
      usage: [{ barangName: 'Kapas', qtyUsed: 5, satuan: 'box', totalCost: 50000 }],
    },
    ...overrides,
  };
}

describe('FinancialReportPdfService', () => {
  let service: FinancialReportPdfService;
  let clinicRepo: { findOne: jest.Mock };
  let reportsService: { getFinancialReportPro: jest.Mock };

  beforeEach(async () => {
    createPdfMock.mockClear();
    createPdfMock.mockReturnValue({
      getBuffer: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
    });
    clinicRepo = { findOne: jest.fn().mockResolvedValue({ id: 1, name: 'Klinik A' }) };
    reportsService = { getFinancialReportPro: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialReportPdfService,
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: ReportsService, useValue: reportsService },
      ],
    }).compile();

    service = module.get<FinancialReportPdfService>(FinancialReportPdfService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('generates a PDF buffer for a period with full data (positive)', async () => {
    reportsService.getFinancialReportPro.mockResolvedValue({
      data: baseFinancialData(),
    });

    const result = await service.generate(1, {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    } as any);

    expect(result).toBeInstanceOf(Buffer);
  });

  it('renders the requested date range in the period line (positive)', async () => {
    reportsService.getFinancialReportPro.mockResolvedValue({
      data: baseFinancialData(),
    });

    await service.generate(1, { dateFrom: '2026-01-01', dateTo: '2026-01-31' } as any);

    const doc = createPdfMock.mock.calls[0][0];
    const periodLine = doc.content.find((c: any) => c.style === 'periodLine');
    expect(periodLine.text).toContain('01 Januari 2026');
    expect(periodLine.text).toContain('31 Januari 2026');
  });

  it('shows a fallback row when there are no top procedures yet (negative/edge)', async () => {
    reportsService.getFinancialReportPro.mockResolvedValue({
      data: baseFinancialData({ tindakanTerlaris: [] }),
    });

    await service.generate(1, { dateFrom: '2026-01-01', dateTo: '2026-01-31' } as any);

    const doc = createPdfMock.mock.calls[0][0];
    expect(JSON.stringify(doc)).toContain('Belum ada data tindakan');
  });

  it('shows a fallback row when there is no doctor profit data yet (negative/edge)', async () => {
    reportsService.getFinancialReportPro.mockResolvedValue({
      data: baseFinancialData({ byDoctorProfit: [] }),
    });

    await service.generate(1, { dateFrom: '2026-01-01', dateTo: '2026-01-31' } as any);

    const doc = createPdfMock.mock.calls[0][0];
    expect(JSON.stringify(doc)).toContain('Belum ada data dokter');
  });

  it('shows a fallback row when there is no material usage yet (negative/edge)', async () => {
    reportsService.getFinancialReportPro.mockResolvedValue({
      data: baseFinancialData({ stockReport: { ...baseFinancialData().stockReport, usage: [] } }),
    });

    await service.generate(1, { dateFrom: '2026-01-01', dateTo: '2026-01-31' } as any);

    const doc = createPdfMock.mock.calls[0][0];
    expect(JSON.stringify(doc)).toContain('Belum ada pemakaian bahan pada periode ini');
  });

  it('caps the rendered material usage rows at 10 (edge)', async () => {
    const usage = Array.from({ length: 15 }, (_, i) => ({
      barangName: `Bahan ${i}`,
      qtyUsed: 1,
      satuan: 'pcs',
      totalCost: 1000,
    }));
    reportsService.getFinancialReportPro.mockResolvedValue({
      data: baseFinancialData({ stockReport: { ...baseFinancialData().stockReport, usage } }),
    });

    await service.generate(1, { dateFrom: '2026-01-01', dateTo: '2026-01-31' } as any);

    const doc = createPdfMock.mock.calls[0][0];
    const stockTable = doc.content.find(
      (c: any) => c.table?.widths?.length === 3,
    );
    expect(stockTable.table.body).toHaveLength(11); // header + 10 rows
  });

  it('falls back to a generic clinic name when the clinic record is missing (negative/edge)', async () => {
    clinicRepo.findOne.mockResolvedValue(null);
    reportsService.getFinancialReportPro.mockResolvedValue({
      data: baseFinancialData(),
    });

    await service.generate(1, { dateFrom: '2026-01-01', dateTo: '2026-01-31' } as any);

    const doc = createPdfMock.mock.calls[0][0];
    expect(doc.content[0].stack[0].text).toBe('Klinik');
  });
});
