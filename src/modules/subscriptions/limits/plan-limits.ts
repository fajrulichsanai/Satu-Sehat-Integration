import type { EntityManager } from 'typeorm';

/**
 * Batas bawaan per tier paket bila paket tidak mengisi kolomnya sendiri
 * (PRD Super Admin, tabel Paket). Masa coba = Starter dengan storage
 * 100 MB (keputusan 15 Okt 2026); setelah upgrade, jatah ikut paket baru.
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
}

/** Batas dari paket langganan terakhir klinik (tanpa langganan = Starter). */
export async function planLimitsForClinic(
  manager: Pick<EntityManager, 'query'>,
  clinicId: number,
): Promise<PlanLimits> {
  const [row] = await manager.query(
    `SELECT p.tier, p.name, p.max_users AS maxUsers, p.storage_gb AS storageGb
       FROM clinic_subscriptions cs
       JOIN subscription_plans p ON p.id = cs.plan_id
      WHERE cs.clinic_id = ?
      ORDER BY cs.id DESC LIMIT 1`,
    [clinicId],
  );
  const tier: string | null = row?.tier ?? null;
  const pick = (value: unknown, defaults: Record<string, number>, fallback: number) =>
    value !== null && value !== undefined
      ? Number(value)
      : ((tier ? defaults[tier] : undefined) ?? fallback);
  return {
    tier,
    planName: row?.name ?? null,
    maxUsers: pick(row?.maxUsers, DEFAULT_MAX_USERS, FALLBACK_MAX_USERS),
    storageGb: pick(row?.storageGb, DEFAULT_STORAGE_GB, FALLBACK_STORAGE_GB),
  };
}

/** Pengali harga untuk siklus paket: tahunan = 10× bulanan. */
export function cycleMultiplier(billingCycle: string | null | undefined): number {
  return billingCycle === 'yearly' ? 10 : 1;
}
