export const GB = 1024 ** 3;

/**
 * Jatah storage bawaan per tier paket bila paket tidak mengisi storage_gb
 * (PRD Super Admin: Starter 1 GB, Pro 5 GB, Multi Klinik 5 GB per cabang
 * dipakai bersama). Klinik tanpa langganan memakai jatah Starter.
 */
export const DEFAULT_STORAGE_GB: Record<string, number> = {
  trial: 1,
  basic: 1,
  pro: 5,
  multi_klinik: 5,
};
export const FALLBACK_STORAGE_GB = 1;

/** Peringatan "hampir penuh" mulai dari persentase ini. */
export const STORAGE_WARN_RATIO = 0.85;
