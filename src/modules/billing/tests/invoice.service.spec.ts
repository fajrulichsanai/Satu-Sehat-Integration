import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

const createPdfMock = jest.fn();

jest.mock('pdfmake', () => ({
  setFonts: jest.fn(),
  setLocalAccessPolicy: jest.fn(),
  setUrlAccessPolicy: jest.fn(),
  createPdf: (...args: any[]) => createPdfMock(...args),
}));

import { InvoiceService } from '../invoice.service';
import { Billing, BillingStatus } from '../entities/billing.entity';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let repo: { findOne: jest.Mock };

  const baseBilling = {
    id: 1,
    clinicId: 1,
    invoiceNumber: 'INV-001',
    status: BillingStatus.PAID,
    subtotal: 100000,
    totalDiscount: 0,
    additionalFee: 0,
    grandTotal: 100000,
    paidAmount: 100000,
    outstandingAmount: 0,
    createdAt: new Date('2026-01-01'),
    items: [
      { name: 'Konsultasi', quantity: 1, unitPrice: 100000, subtotal: 100000 },
    ],
    patient: { name: 'Budi', noRm: 'RM001' },
    clinic: { name: 'Klinik Sehat', phone: '0800', email: 'a@x.com' },
  };

  beforeEach(async () => {
    createPdfMock.mockClear();
    createPdfMock.mockReturnValue({
      getBuffer: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')),
    });
    repo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: getRepositoryToken(Billing), useValue: repo },
      ],
    }).compile();

    service = module.get<InvoiceService>(InvoiceService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('generates a PDF buffer for an existing billing (positive)', async () => {
    repo.findOne.mockResolvedValue({ ...baseBilling });

    const result = await service.generateInvoicePdf(1, 1);

    expect(result).toBeInstanceOf(Buffer);
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 1, clinicId: 1 },
      relations: { patient: true, items: true, clinic: true },
    });
  });

  it('throws NotFoundException when billing does not exist (negative)', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.generateInvoicePdf(999, 1)).rejects.toThrow(
      NotFoundException,
    );
    expect(createPdfMock).not.toHaveBeenCalled();
  });

  it('does not scope-leak across clinics — queries by both id and clinicId (negative)', async () => {
    repo.findOne.mockResolvedValue(null);
    await service.generateInvoicePdf(1, 2).catch(() => undefined);
    expect(repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1, clinicId: 2 } }),
    );
  });

  it('includes a discount line only when totalDiscount > 0 (positive)', async () => {
    repo.findOne.mockResolvedValue({ ...baseBilling, totalDiscount: 5000 });

    await service.generateInvoicePdf(1, 1);

    const doc = createPdfMock.mock.calls[0][0];
    const totalsStack = doc.content[4].columns[1].stack;
    const labels = totalsStack
      .filter((row: any) => row.columns)
      .map((row: any) => row.columns[0].text);
    expect(labels).toContain('Diskon');
  });

  it('omits the discount line when totalDiscount is 0 (negative/edge)', async () => {
    repo.findOne.mockResolvedValue({ ...baseBilling, totalDiscount: 0 });

    await service.generateInvoicePdf(1, 1);

    const doc = createPdfMock.mock.calls[0][0];
    const totalsStack = doc.content[4].columns[1].stack;
    const labels = totalsStack
      .filter((row: any) => row.columns)
      .map((row: any) => row.columns[0].text);
    expect(labels).not.toContain('Diskon');
  });

  it('shows the outstanding-amount breakdown only for a partially paid, unpaid-status billing (positive)', async () => {
    repo.findOne.mockResolvedValue({
      ...baseBilling,
      status: BillingStatus.PARTIAL,
      paidAmount: 40000,
      outstandingAmount: 60000,
    });

    await service.generateInvoicePdf(1, 1);

    const doc = createPdfMock.mock.calls[0][0];
    const totalsStack = doc.content[4].columns[1].stack;
    const labels = totalsStack
      .filter((row: any) => row.columns)
      .map((row: any) => row.columns[0].text);
    expect(labels).toContain('Sisa Tagihan');
  });

  it('hides the outstanding-amount breakdown once billing is fully PAID (negative/edge)', async () => {
    repo.findOne.mockResolvedValue({ ...baseBilling });

    await service.generateInvoicePdf(1, 1);

    const doc = createPdfMock.mock.calls[0][0];
    const totalsStack = doc.content[4].columns[1].stack;
    const labels = totalsStack
      .filter((row: any) => row.columns)
      .map((row: any) => row.columns[0].text);
    expect(labels).not.toContain('Sisa Tagihan');
  });

  it('renders an empty item table without throwing when billing has no items (edge)', async () => {
    repo.findOne.mockResolvedValue({ ...baseBilling, items: [] });
    await expect(service.generateInvoicePdf(1, 1)).resolves.toBeInstanceOf(
      Buffer,
    );
  });
});
