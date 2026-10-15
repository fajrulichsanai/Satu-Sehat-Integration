import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../enums';

/** Header the frontend proxy sets while a Multi-Klinik Owner is inside a branch. */
export const BRANCH_HEADER = 'x-clinic-id';

/**
 * Routes that always run as the Multi-Klinik Owner themselves (their own
 * account, branch list, combined billing), never as the active branch —
 * otherwise their role would read as `owner` and @Roles(MULTI_CLINIC_OWNER)
 * would refuse them.
 */
const OWNER_SCOPED_PREFIXES = ['/auth/', '/multi-clinic'];

export function isOwnerScopedPath(path: string | undefined): boolean {
  const p = path ?? '';
  return OWNER_SCOPED_PREFIXES.some((prefix) => p.startsWith(prefix));
}

/**
 * Parses the branch header. Anything that is not a positive integer is
 * treated as "no branch" rather than an error — the request then simply
 * has no clinic, and clinic endpoints answer BRANCH_REQUIRED.
 */
export function parseBranchHeader(
  value: string | string[] | undefined,
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !/^\d{1,10}$/.test(raw.trim())) return null;
  const id = Number(raw.trim());
  return id > 0 ? id : null;
}

/** Role recorded in the audit log for a request (branch mode keeps the real role). */
export function auditRoleOf(
  user: { role?: string; actorRole?: string } | undefined | null,
): string {
  return user?.actorRole ?? user?.role ?? 'unknown';
}

export const BRANCH_ACTOR_ROLE = UserRole.MULTI_CLINIC_OWNER;

/**
 * 403 for a request that needs a clinic but has none. A Multi-Klinik Owner
 * outside a branch gets told to pick one (PRD: "Pilih cabang dulu").
 */
export function noClinicError(
  user: { role?: string } | undefined | null,
  fallbackMessage: string,
): ForbiddenException {
  if (user?.role === UserRole.MULTI_CLINIC_OWNER) {
    return new ForbiddenException({
      success: false,
      error: {
        code: 'BRANCH_REQUIRED',
        message: 'Pilih cabang dulu untuk membuka halaman ini.',
      },
    });
  }
  return new ForbiddenException({
    success: false,
    error: { code: 'NO_CLINIC_ASSIGNED', message: fallbackMessage },
  });
}
