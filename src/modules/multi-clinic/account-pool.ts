import { ForbiddenException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ACCOUNTS_PER_BRANCH } from './multi-clinic.constants';
import {
  planLimitsForClinic,
  TIER_LABEL,
} from '../subscriptions/limits/plan-limits';

export interface AccountPool {
  ownerId: number;
  used: number;
  limit: number;
  activeBranches: number;
}

/**
 * Jatah akun gabungan untuk owner multiklinik yang memiliki `clinicId`
 * (PRD MK-07: 25 akun × jumlah cabang aktif, dihitung bersama). Null bila
 * klinik itu tidak terhubung (atau cabangnya sudah "berhenti") — klinik
 * biasa tidak ikut pool ini.
 */
export async function accountPoolForClinic(
  manager: EntityManager,
  clinicId: number,
): Promise<AccountPool | null> {
  const [link] = await manager.query(
    `SELECT owner_id AS ownerId FROM owner_clinic_links
      WHERE clinic_id = ? AND status = 'approved' AND billing_mode <> 'stopped'
      LIMIT 1`,
    [clinicId],
  );
  if (!link) return null;
  return accountPoolForOwner(manager, Number(link.ownerId));
}

export async function accountPoolForOwner(
  manager: EntityManager,
  ownerId: number,
): Promise<AccountPool> {
  const [row] = await manager.query(
    `SELECT
       (SELECT COUNT(*) FROM owner_clinic_links
         WHERE owner_id = ? AND status = 'approved' AND billing_mode <> 'stopped') AS branches,
       (SELECT COUNT(*) FROM users u
          JOIN owner_clinic_links l ON l.clinic_id = u.clinic_id
         WHERE l.owner_id = ? AND l.status = 'approved' AND l.billing_mode <> 'stopped'
           AND u.is_active = 1 AND u.role <> 'pending') AS used`,
    [ownerId, ownerId],
  );
  const activeBranches = Number(row?.branches ?? 0);
  return {
    ownerId,
    used: Number(row?.used ?? 0),
    limit: activeBranches * ACCOUNTS_PER_BRANCH,
    activeBranches,
  };
}

export interface AccountQuota {
  used: number;
  limit: number;
  /** clinic = batas paket klinik sendiri; multiklinik = jatah bersama cabang. */
  scope: 'clinic' | 'multiklinik';
  tier: string | null;
  planName: string | null;
  activeBranches?: number;
}

/**
 * Batas akun aktif yang berlaku untuk klinik ini (PRD Super Admin BL-02):
 * jatah bersama bila ia cabang multiklinik, selain itu batas paketnya
 * (Starter 5, Pro & masa coba 25). Hanya akun aktif yang dihitung.
 */
export async function accountQuotaForClinic(
  manager: EntityManager,
  clinicId: number,
): Promise<AccountQuota> {
  const pool = await accountPoolForClinic(manager, clinicId);
  if (pool) {
    return {
      used: pool.used,
      limit: pool.limit,
      scope: 'multiklinik',
      tier: 'multi_klinik',
      planName: 'Multi Klinik',
      activeBranches: pool.activeBranches,
    };
  }
  const [row] = await manager.query(
    `SELECT COUNT(*) AS used FROM users
      WHERE clinic_id = ? AND is_active = 1 AND role <> 'pending'`,
    [clinicId],
  );
  const plan = await planLimitsForClinic(manager, clinicId);
  return {
    used: Number(row?.used ?? 0),
    limit: plan.maxUsers,
    scope: 'clinic',
    tier: plan.tier,
    planName: plan.planName,
  };
}

/**
 * Throws ACCOUNT_LIMIT_REACHED when one more active account would exceed
 * the clinic's limit — its plan's, or the shared multiklinik pool.
 */
export async function assertAccountRoom(
  manager: EntityManager | undefined,
  clinicId: number | null | undefined,
): Promise<void> {
  if (!manager || !clinicId) return;
  const quota = await accountQuotaForClinic(manager, clinicId);
  if (quota.used < quota.limit) return;
  const tierName = TIER_LABEL[quota.tier ?? ''] ?? quota.planName ?? 'Starter';
  const message =
    quota.scope === 'multiklinik'
      ? `Jatah akun gabungan multiklinik sudah penuh (${quota.used}/${quota.limit}). Nonaktifkan akun yang tidak dipakai atau hubungi owner multiklinik.`
      : quota.tier === 'basic' || !quota.tier
        ? `Batas akun paket ${tierName} sudah penuh (${quota.used}/${quota.limit}). Naik ke paket Pro untuk sampai 25 akun, atau nonaktifkan akun yang tidak dipakai.`
        : `Batas akun paket ${tierName} sudah penuh (${quota.used}/${quota.limit}). Nonaktifkan akun yang tidak dipakai, atau hubungi tim ApexRecord untuk batas lebih besar.`;
  throw new ForbiddenException({
    success: false,
    error: { code: 'ACCOUNT_LIMIT_REACHED', message },
  });
}

/** @deprecated use assertAccountRoom (now also enforces plan limits). */
export const assertAccountPoolHasRoom = assertAccountRoom;
