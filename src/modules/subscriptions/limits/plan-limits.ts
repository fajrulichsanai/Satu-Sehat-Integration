import type { EntityManager } from 'typeorm';

/**
 * Batas bawaan per tier paket bila paket tidak mengisi kolomnya sendiri
 * (PRD Super Admin, tabel Paket). Masa coba 14 hari (keputusan 15 Okt
 * 2026): 7 hari pertama batas Starter, lalu otomatis naik ke batas Pro
 * selama 7 hari berikutnya; storage tetap maks. 100 MB. Setelah upgrade,
 * jatah ikut paket baru.
 * Klinik tanpa langganan memakai batas Starter.
 * Multi Klinik: per cabang aktif, dipakai bersama (lihat multi-clinic).
 */
export const DEFAULT_MAX_USERS: Record<string, number> = {
  trial: 5,
  basic: 5,
  pro: 25,
  multi_klinik: 25,
};
export const DEFAULT_STORAGE_GB: Record<string, number> = {
  trial: 0.1,
  basic: 1,
  pro: 5,
  multi_klinik: 5,
};
/** Hari pertama masa coba dengan batas Starter; sesudahnya batas Pro. */
export const TRIAL_STARTER_DAYS = 7;

export type TrialStage = 'starter' | 'pro';

/** Tahap masa coba pada `today` (YYYY-MM-DD) untuk langganan yang mulai `startDate`. */
export function trialStage(
  startDate: string,
  today: string = localIsoDate(),
): TrialStage {
  const start = new Date(
    `${String(startDate).slice(0, 10)}T00:00:00`,
  ).getTime();
  const now = new Date(`${today}T00:00:00`).getTime();
  return Math.floor((now - start) / 86_400_000) >= TRIAL_STARTER_DAYS
    ? 'pro'
    : 'starter';
}

/** Tanggal masa coba naik ke batas Pro. */
export function trialProFrom(startDate: string): string {
  const d = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + TRIAL_STARTER_DAYS);
  return localIsoDate(d);
}

function localIsoDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const FALLBACK_MAX_USERS = DEFAULT_MAX_USERS.basic;
export const FALLBACK_STORAGE_GB = DEFAULT_STORAGE_GB.basic;

/** Harga storage tambahan per GB per bulan (tahunan = 10× bulanan, seperti paket). */
export const STORAGE_ADDON_PRICE_PER_GB = 10_000;

export const TIER_LABEL: Record<string, string> = {
  trial: 'Masa coba',
  basic: 'Starter',
  pro: 'Pro',
  multi_klinik: 'Multi Klinik',
};

export interface PlanLimits {
  tier: string | null;
  planName: string | null;
  maxUsers: number;
  storageGb: number;
  /** Masa coba: tahap batas yang berlaku hari ini (Starter atau Pro). */
  trialStage?: TrialStage;
  trialProFrom?: string;
}

/** Batas dari paket langganan yang berlaku (tanpa langganan = Starter). */
export async function planLimitsForClinic(
  manager: Pick<EntityManager, 'query'>,
  clinicId: number,
): Promise<PlanLimits> {
  const [row] = await manager.query(
    `SELECT p.tier, p.name, p.max_users AS maxUsers, p.storage_gb AS storageGb,
            DATE_FORMAT(cs.start_date, '%Y-%m-%d') AS startDate
       FROM clinic_subscriptions cs
       JOIN subscription_plans p ON p.id = cs.plan_id
      WHERE cs.clinic_id = ?
      -- Paket yang berlaku hari ini; periode yang dibayar di muka (mis.
      -- turun paket) baru berlaku saat tanggal mulainya tiba.
      ORDER BY (cs.start_date <= CURDATE()) DESC, cs.id DESC LIMIT 1`,
    [clinicId],
  );
  const tier: string | null = row?.tier ?? null;
  const pick = (
    value: unknown,
    defaults: Record<string, number>,
    fallback: number,
  ) =>
    value !== null && value !== undefined
      ? Number(value)
      : ((tier ? defaults[tier] : undefined) ?? fallback);
  const limits: PlanLimits = {
    tier,
    planName: row?.name ?? null,
    maxUsers: pick(row?.maxUsers, DEFAULT_MAX_USERS, FALLBACK_MAX_USERS),
    storageGb: pick(row?.storageGb, DEFAULT_STORAGE_GB, FALLBACK_STORAGE_GB),
  };
  if (tier === 'trial' && row?.startDate) {
    limits.trialStage = trialStage(row.startDate);
    limits.trialProFrom = trialProFrom(row.startDate);
    // Minggu kedua: batas akun Pro; storage tetap jatah masa coba.
    if (limits.trialStage === 'pro') {
      limits.maxUsers = Math.max(limits.maxUsers, DEFAULT_MAX_USERS.pro);
    }
  }
  return limits;
}

/** Pengali harga untuk siklus paket: tahunan = 10× bulanan. */
export function cycleMultiplier(
  billingCycle: string | null | undefined,
): number {
  return billingCycle === 'yearly' ? 10 : 1;
}
