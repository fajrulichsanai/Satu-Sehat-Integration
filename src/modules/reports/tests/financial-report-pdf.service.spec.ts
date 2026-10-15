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
import { ProfitLossService, type ProfitLoss } from '../profit-loss.service';

function pl(overrides: Partial<ProfitLoss> = {}): ProfitLoss {
  return {
    periode: { dateFrom: '2026-01-01', dateTo: '2026-01-31' },
    pendapatan: {
      tindakanBruto: 10500000,
      diskonTindakan: 300000,
      diskonTagihan: 200000,
      biayaTambahan: 0,
      bersih: 10000000,
      jumlahTagihan: 12,
    },
    hpp: { modalBahan: 1000000, biayaLab: 500000, total: 1500000 },
    labaKotor: 8500000,
    beban: {
      shareFeeDokter: 2000000,
      gaji: 3000000,
      operasional: [{ kategori: 'listrik', label: 'Listrik', total: 500000 }],
      totalOperasional: 500000,
      total: 5500000,
    },
    labaBersih: 3000000,
    marginPersen: 30,
    belanja: {
      rincian: [
        { kategori: 'alat_dental', label: 'Beli Alat Dental', total: 750000 },
      ],
      total: 750000,
    },
    kas: {
      masuk: 9000000,
      perMetode: [{ method: 'cash', amount: 9000000 }],
      keluar: 6250000,
      selisih: 2750000,
      piutang: 1000000,
      refund: 0,
    },
    dokter: [
      {
        practitionerId: 1,
        nama: 'drg. A',
        tindakan: 10,
        pendapatan: 10000000,
        biayaLab: 500000,
        dasarFee: 6500000,
        shareFee: 2000000,
        bankName: 'BCA',
        bankAccount: '123',
        bankHolder: 'drg. A',
      },
    ],
    tindakan: [
      {
        tarifId: 1,
        nama: 'Crown',
        kategori: 'Prostodonti',
        qty: 2,
        hargaRata: 1500000,
        bruto: 3000000,
        diskon: 0,
        pendapatan: 3000000,
        modal: 400000,
        biayaLab: 500000,
        shareFee: 750000,
        laba: 1350000,
      },
    ],
    pengeluaran: [
      {
        tanggal: '2026-01-05',
        kategori: 'listrik',
        label: 'Listrik',
        deskripsi: 'PLN',
        nominal: 500000,
      },
    ],
    stokPerluBeli: [
      {
        nama: 'Kapas',
        satuan: 'pcs',
        stok: 2,
        minimum: 10,
        saranBeli: 18,
        estimasi: 18000,
        supplier: null,
      },
    ],
    payroll: null,
    ...overrides,
  };
}

const flatten = (node: unknown): string =>
  JSON.stringify(node, (_k, v) => (typeof v === 'function' ? undefined : v));

describe('FinancialReportPdfService', () => {
  let service: FinancialReportPdfService;
  let profitLoss: { compute: jest.Mock; trend: jest.Mock };

  beforeEach(async () => {
    createPdfMock.mockClear();
    createPdfMock.mockReturnValue({
      getBuffer: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
    });
    profitLoss = {
      compute: jest.fn().mockResolvedValue(pl()),
      trend: jest.fn().mockResolvedValue([
        {
          month: '2026-01',
          revenue: 10000000,
          modal: 1500000,
          labaKotor: 8500000,
          expense: 5500000,
          netProfit: 3000000,
        },
      ]),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialReportPdfService,
        {
          provide: getRepositoryToken(Clinic),
          useValue: {
            findOne: jest
              .fn()
              .mockResolvedValue({ id: 1, name: 'Klinik A', city: 'Depok' }),
          },
        },
        { provide: ProfitLossService, useValue: profitLoss },
      ],
    }).compile();
    service = module.get(FinancialReportPdfService);
  });

  const query = { dateFrom: '2026-01-01', dateTo: '2026-01-31' } as any;

  it('menghasilkan buffer PDF', async () => {
    const result = await service.generate(1, query);
    expect(result).toBeInstanceOf(Buffer);
    expect(profitLoss.compute).toHaveBeenCalledWith(
      1,
      '2026-01-01',
      '2026-01-31',
    );
    expect(profitLoss.trend).toHaveBeenCalledWith(1, '2026-01-31', 6);
  });

  it('memuat laba rugi, share fee + rekening dokter, stok perlu dibeli', async () => {
    await service.generate(1, query);
    const doc = flatten(createPdfMock.mock.calls[0][0]);
    expect(doc).toContain('LABA BERSIH');
    expect(doc).toContain('Rp 3.000.000');
    expect(doc).toContain('drg. A');
    expect(doc).toContain('BCA 123');
    expect(doc).toContain('Kapas');
    expect(doc).toContain('Biaya lab');
  });

  it('menampilkan laba bersih negatif dalam kurung', async () => {
    profitLoss.compute.mockResolvedValue(pl({ labaBersih: -250000 }));
    await service.generate(1, query);
    expect(flatten(createPdfMock.mock.calls[0][0])).toContain('(Rp 250.000)');
  });

  it('tetap jalan saat periode kosong', async () => {
    profitLoss.compute.mockResolvedValue(
      pl({
        dokter: [],
        tindakan: [],
        pengeluaran: [],
        stokPerluBeli: [],
        belanja: { rincian: [], total: 0 },
      }),
    );
    await expect(service.generate(1, query)).resolves.toBeInstanceOf(Buffer);
    const doc = flatten(createPdfMock.mock.calls[0][0]);
    expect(doc).toContain('Semua stok aman');
    expect(doc).toContain('Tidak ada share fee');
  });
});
