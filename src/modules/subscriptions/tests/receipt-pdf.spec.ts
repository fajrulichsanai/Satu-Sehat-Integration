import { renderReceiptPdf } from '../receipt-pdf';

describe('renderReceiptPdf', () => {
  const base = {
    number: 'APX-000012',
    status: 'Lunas, dikonfirmasi',
    kind: 'new' as const,
    confirmedAt: new Date('2026-10-15'),
    planName: 'Pro',
    quantity: 1,
    months: 3,
    amount: 424650,
    promoDiscount: 450000,
    durationDiscount: 22350,
    extraStorageGb: 0,
    storageAmount: 0,
    billedTo: { name: 'Klinik A', email: null },
    clinics: [{ id: 3, name: 'Klinik A' }],
  };

  it('renders a PDF for a confirmed payment (positive)', async () => {
    const pdf = await renderReceiptPdf(base);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('renders an upgrade receipt without discounts (edge)', async () => {
    const pdf = await renderReceiptPdf({
      ...base,
      kind: 'upgrade',
      months: 0,
      amount: 50000,
      promoDiscount: 0,
      durationDiscount: 0,
    });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
