import { effectivePrice, isPromoActive, quotePrice } from '../limits/pricing';

const starter = {
  price: 199000,
  promoPrice: 99000,
  promoUntil: '2026-12-31',
  ownerFee: 0,
  billingCycle: 'monthly',
};

describe('pricing', () => {
  it('uses the promo price up to and including promoUntil (positive)', () => {
    expect(isPromoActive(starter, '2026-12-31')).toBe(true);
    expect(effectivePrice(starter, '2026-12-31')).toBe(99000);
  });

  it('falls back to the normal price after promoUntil (negative)', () => {
    expect(isPromoActive(starter, '2027-01-01')).toBe(false);
    expect(effectivePrice(starter, '2027-01-01')).toBe(199000);
    const q = quotePrice({ plan: starter, months: 1, on: '2027-01-01' });
    expect(q).toMatchObject({
      promoActive: false,
      promoDiscount: 0,
      total: 199000,
    });
  });

  it('ignores a promo that is not cheaper or has no end date (edge)', () => {
    expect(
      isPromoActive({ ...starter, promoPrice: 250000 }, '2026-01-01'),
    ).toBe(false);
    expect(isPromoActive({ ...starter, promoUntil: null }, '2026-01-01')).toBe(
      false,
    );
  });

  it('applies the duration discount on the promo price (positive)', () => {
    const q = quotePrice({ plan: starter, months: 12, on: '2026-10-15' });
    expect(q).toMatchObject({
      listSubtotal: 2388000,
      promoDiscount: 1200000,
      durationDiscountPct: 17,
      durationDiscount: 201960,
      total: 986040,
    });
  });

  it('uses custom discounts and multiplies owner fee × clinics × months (positive)', () => {
    const q = quotePrice({
      plan: { price: 124000, ownerFee: 50000, billingCycle: 'monthly' },
      months: 3,
      quantity: 2,
      extraStorageGb: 2,
      discounts: { 1: 0, 3: 10, 6: 0, 12: 0 },
    });
    // (124.000×2 + 50.000)×3 = 894.000; −10% = 89.400; storage 2×10.000×3
    expect(q).toMatchObject({
      durationDiscount: 89400,
      storageAmount: 60000,
      total: 864600,
    });
  });

  it('keeps a legacy yearly plan to one period without duration discount (edge)', () => {
    const q = quotePrice({
      plan: { price: 990000, billingCycle: 'yearly' },
      months: 12,
      extraStorageGb: 1,
    });
    expect(q).toMatchObject({
      months: 1,
      durationDiscount: 0,
      storageAmount: 100000,
      total: 1090000,
    });
  });
});

describe('pricing — promo Multi Klinik', () => {
  const multi = {
    price: 249000,
    promoPrice: 124000,
    promoUntil: '2026-12-31',
    ownerFee: 99000,
    promoOwnerFee: 50000,
    billingCycle: 'monthly',
  };

  it('discounts both the per-clinic price and the owner fee during the promo (positive)', () => {
    const q = quotePrice({
      plan: multi,
      quantity: 4,
      months: 1,
      on: '2026-10-15',
    });
    // normal 4×249.000 + 99.000 = 1.095.000; promo 4×124.000 + 50.000 = 546.000
    expect(q).toMatchObject({
      listSubtotal: 1095000,
      promoDiscount: 549000,
      ownerFee: 50000,
      listOwnerFee: 99000,
      total: 546000,
    });
  });

  it('charges the normal owner fee after the promo (negative)', () => {
    const q = quotePrice({
      plan: multi,
      quantity: 1,
      months: 1,
      on: '2027-01-01',
    });
    expect(q).toMatchObject({
      ownerFee: 99000,
      promoDiscount: 0,
      total: 348000,
    });
  });

  it('keeps a self-paying branch free of the owner fee (edge)', () => {
    const q = quotePrice({
      plan: multi,
      quantity: 1,
      months: 1,
      ownerFee: 0,
      on: '2026-10-15',
    });
    expect(q).toMatchObject({ ownerFee: 0, listOwnerFee: 0, total: 124000 });
  });

  it('gives the owner fee 2 free months at 12 bulan, separate from the per-clinic duration discount (positive)', () => {
    const plan = { price: 149000, ownerFee: 49000, billingCycle: 'monthly' };
    const q = quotePrice({
      plan,
      quantity: 2,
      months: 12,
      on: '2027-06-01', // no promo active
    });
    // Admin fee: 49.000 × 12 = 588.000, hemat 2 bulan (98.000) → 490.000.
    // Harga cabang: 149.000 × 2 × 12 = 3.576.000, diskon 17% = 607.920.
    expect(q).toMatchObject({
      listOwnerFee: 49000,
      ownerFee: 49000,
      durationDiscountPct: 17,
      durationDiscount: 607920 + 98000,
      total: 3576000 + 588000 - (607920 + 98000),
    });
  });
});
