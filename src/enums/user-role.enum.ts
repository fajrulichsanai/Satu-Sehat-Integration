export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  MULTI_CLINIC_OWNER = 'multi_clinic_owner',
  OWNER = 'owner',
  ADMIN = 'admin',
  DOKTER = 'dokter',
  PERAWAT = 'perawat',
  PENDING = 'pending',
}

// Lower number = more privileged. Used to enforce "can't manage/assign a role at or above your own level".
export const ROLE_LEVEL: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 0,
  [UserRole.MULTI_CLINIC_OWNER]: 1,
  [UserRole.OWNER]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.DOKTER]: 3,
  [UserRole.PERAWAT]: 3,
  [UserRole.PENDING]: 99,
};

/**
 * Tenaga kesehatan yang memakai akun klinis (rekam medis, kunjungan miliknya).
 * Perawat diperlakukan sama persis dengan dokter.
 */
export const CLINICIAN_ROLES: readonly UserRole[] = [
  UserRole.DOKTER,
  UserRole.PERAWAT,
];

export function isClinician(
  role: UserRole | string | null | undefined,
): boolean {
  return CLINICIAN_ROLES.includes(role as UserRole);
}
