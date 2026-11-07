import { STORAGE_ADDON_PRICE_PER_GB, cycleMultiplier } from './plan-limits';

/** Lama langganan yang bisa dipilih (bulan). */
export const DURATION_OPTIONS = [1, 3, 6, 12] as const;
export type DurationMonths = (typeof DURATION_OPTIONS)[number];

/**
 * Diskon lama langganan bawaan (%); bisa diubah Super Admin di Pengaturan
 * Platform. 12 bulan ≈ gratis 2 bulan, sama dengan harga tahunan lama.
 */
export const DEFAULT_DURATION_DISCOUNTS: Record<number, number> = {
  1: 0,
  3: 5,
  6: 10,
  12: 17,
};

/**
 * Diskon biaya admin owner Multi Klinik: bulan gratis, bukan persen — beda
 * dari diskon harga per-klinik di atas. 12 bulan = bayar 10 bulan (hemat 2
 * bulan), sesuai permintaan: admin fee Rp49rb/bulan, 1 tahun cukup Rp490rb.
 */
export const OWNER_FEE_FREE_MONTHS: Record<number, number> = {
  1: 0,
  3: 0,
  6: 0,
  12: 2,
};

export interface PricedPlan {
  price: number | string;
  promoPrice?: number | string | null;
  promoUntil?: string | null;
  ownerFee?: number | string | null;
  promoOwnerFee?: number | string | null;
  billingCycle?: string | null;
}

/** YYYY-MM-DD in server-local time. */
export function today(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isPromoActive(plan: PricedPlan, on: string = today()): boolean {
  return (
    plan.promoPrice !== null &&
    plan.promoPrice !== undefined &&
    !!plan.promoUntil &&
    on <= String(plan.promoUntil).slice(0, 10) &&
    Number(plan.promoPrice) < Number(plan.price)
  );
}

/** Harga per bulan (per klinik untuk Multi Klinik) yang berlaku hari ini. */
export function effectivePrice(plan: PricedPlan, on: string = today()): number {
  return isPromoActive(plan, on) ? Number(plan.promoPrice) : Number(plan.price);
}

export interface PriceQuote {
  months: number;
  quantity: number;
  /** Harga normal per bulan (per klinik). */
  listUnitPrice: number;
  /** Harga yang berlaku per bulan (per klinik) — promo bila aktif. */
  unitPrice: number;
  promoActive: boolean;
  promoUntil: string | null;
  /** Biaya admin owner per bulan yang berlaku (promo bila aktif). */
  ownerFee: number;
  /** Biaya admin owner per bulan, harga normal. */
  listOwnerFee: number;
  /** Paket × bulan, dengan harga normal. */
  listSubtotal: number;
  /** Potongan karena harga promo. */
  promoDiscount: number;
  durationDiscountPct: number;
  /** Potongan karena lama langganan (dari harga setelah promo). */
  durationDiscount: number;
  extraStorageGb: number;
  storageAmount: number;
  total: number;
}

/**
 * Satu rumus harga untuk pratinjau dan klaim pembayaran:
 * (harga × jumlah klinik + biaya owner) × bulan, dikurangi promo dan diskon
 * lama langganan, ditambah storage tambahan × bulan (storage tidak didiskon).
 * Paket tahunan lama (billing_cycle = yearly) selalu 1 periode.
 */
export function quotePrice(input: {
  plan: PricedPlan;
  months?: number;
  quantity?: number;
  ownerFee?: number;
  extraStorageGb?: number;
  discounts?: Record<number, number>;
  ownerFeeFreeMonths?: Record<number, number>;
  on?: string;
}): PriceQuote {
  const yearlyPlan = input.plan.billingCycle === 'yearly';
  const months = yearlyPlan ? 1 : (input.months ?? 1);
  const quantity = Math.max(1, input.quantity ?? 1);
  const on = input.on ?? today();
  const listOwnerFee = Math.max(
    0,
    input.ownerFee ?? Number(input.plan.ownerFee ?? 0),
  );
  const listUnitPrice = Number(input.plan.price);
  const promoActive = isPromoActive(input.plan, on);
  const unitPrice = effectivePrice(input.plan, on);

  // Biaya admin owner ikut promo bila paketnya punya promoOwnerFee.
  const promoFee = input.plan.promoOwnerFee;
  const ownerFee =
    promoActive &&
    listOwnerFee > 0 &&
    promoFee !== null &&
    promoFee !== undefined
      ? Math.min(listOwnerFee, Math.max(0, Number(promoFee)))
      : listOwnerFee;
  const clinicListSubtotal = listUnitPrice * quantity * months;
  const clinicAfterPromo = unitPrice * quantity * months;
  const listSubtotal = clinicListSubtotal + listOwnerFee * months;
  const afterPromo = clinicAfterPromo + ownerFee * months;
  const durationDiscountPct = yearlyPlan
    ? 0
    : ((input.discounts ?? DEFAULT_DURATION_DISCOUNTS)[months] ?? 0);

  // Biaya admin owner punya diskon sendiri (bulan gratis, bukan persen) untuk
  // lama langganan yang terdaftar di OWNER_FEE_FREE_MONTHS (mis. 12 bulan =
  // hemat 2 bulan). Lama langganan lain tetap ikut diskon persen gabungan
  // seperti sebelumnya, supaya perilaku lama (mis. 3/6 bulan) tidak berubah.
  const ownerFeeFreeMonths = yearlyPlan
    ? 0
    : Math.min(
        months,
        (input.ownerFeeFreeMonths ?? OWNER_FEE_FREE_MONTHS)[months] ?? 0,
      );
  let clinicDiscount: number;
  let ownerFeeDiscount: number;
  if (ownerFeeFreeMonths > 0) {
    clinicDiscount = Math.round((clinicAfterPromo * durationDiscountPct) / 100);
    ownerFeeDiscount = ownerFee * ownerFeeFreeMonths;
  } else {
    clinicDiscount = Math.round((afterPromo * durationDiscountPct) / 100);
    ownerFeeDiscount = 0;
  }
  const durationDiscount = clinicDiscount + ownerFeeDiscount;

  const extraStorageGb = Math.max(0, input.extraStorageGb ?? 0);
  const storageAmount =
    extraStorageGb *
    STORAGE_ADDON_PRICE_PER_GB *
    (yearlyPlan ? cycleMultiplier('yearly') : months);

  return {
    months,
    quantity,
    listUnitPrice,
    unitPrice,
    promoActive,
    promoUntil: promoActive ? String(input.plan.promoUntil).slice(0, 10) : null,
    ownerFee,
    listOwnerFee,
    listSubtotal,
    promoDiscount: listSubtotal - afterPromo,
    durationDiscountPct,
    durationDiscount,
    extraStorageGb,
    storageAmount,
    total: afterPromo - durationDiscount + storageAmount,
  };
}
