export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  OWNER = 'owner',
  ADMIN = 'admin',
  DOKTER = 'dokter',
  PENDING = 'pending',
}

// Lower number = more privileged. Used to enforce "can't manage/assign a role at or above your own level".
export const ROLE_LEVEL: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 0,
  [UserRole.OWNER]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.DOKTER]: 3,
  [UserRole.PENDING]: 99,
};
