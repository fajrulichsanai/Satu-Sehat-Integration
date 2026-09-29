import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../enums';

export const SKIP_MFA_ENFORCEMENT_KEY = 'skipMfaEnforcement';

/**
 * Marks a controller/route as exempt from the MFA enforcement gate — used
 * for the MFA setup endpoints themselves (a user can't turn MFA on if the
 * gate blocks them from reaching /auth/mfa/setup) plus /auth/me and
 * /auth/logout, which must stay reachable regardless of MFA state.
 */
export const SkipMfaEnforcement = () =>
  SetMetadata(SKIP_MFA_ENFORCEMENT_KEY, true);

/**
 * Roles required to have MFA enabled before using anything else: platform
 * Super Admins and clinic owners. ADMIN and DOKTER may still opt in from the
 * Keamanan page, but are not forced to.
 */
export const MFA_ENFORCED_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.MULTI_CLINIC_OWNER,
  UserRole.OWNER,
];

/**
 * Global gate: once a privileged-role account has logged in, every route
 * except the MFA setup endpoints (and /auth/me, /auth/logout) is rejected
 * with MFA_SETUP_REQUIRED until they actually enable MFA. Relies on
 * JwtStrategy attaching a fresh `mfaEnabled` on every request (it already
 * re-fetches the user row for validateUser, so this adds no extra query).
 */
@Injectable()
export class MfaEnforcementGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_MFA_ENFORCEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return true;

    if (!MFA_ENFORCED_ROLES.includes(user.role)) return true;
    if (user.mfaEnabled) return true;

    throw new HttpException(
      {
        success: false,
        error: {
          code: 'MFA_SETUP_REQUIRED',
          message:
            'Akun dengan peran ini wajib mengaktifkan verifikasi dua langkah (MFA) sebelum melanjutkan.',
        },
      },
      403,
    );
  }
}
