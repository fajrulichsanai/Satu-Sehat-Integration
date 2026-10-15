import { ForbiddenException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ACCOUNTS_PER_BRANCH } from './multi-clinic.constants';

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

/** Throws ACCOUNT_LIMIT_REACHED when one more active account would exceed the pool. */
export async function assertAccountPoolHasRoom(
  manager: EntityManager | undefined,
  clinicId: number | null | undefined,
): Promise<void> {
  if (!manager || !clinicId) return;
  const pool = await accountPoolForClinic(manager, clinicId);
  if (!pool || pool.used < pool.limit) return;
  throw new ForbiddenException({
    success: false,
    error: {
      code: 'ACCOUNT_LIMIT_REACHED',
      message: `Jatah akun gabungan multiklinik sudah penuh (${pool.used}/${pool.limit}). Nonaktifkan akun yang tidak dipakai atau hubungi owner multiklinik.`,
    },
  });
}
