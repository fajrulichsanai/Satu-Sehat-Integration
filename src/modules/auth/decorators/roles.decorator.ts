import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../../enums';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for an endpoint
 * Usage: @Roles(UserRole.OWNER, UserRole.ADMIN)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
