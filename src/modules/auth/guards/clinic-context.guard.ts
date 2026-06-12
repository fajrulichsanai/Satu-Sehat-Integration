import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const SKIP_CLINIC_CHECK_KEY = 'skipClinicCheck';

/**
 * Decorator to skip clinic context validation
 * Use for endpoints that don't require clinic isolation (e.g., owner managing multiple clinics)
 */
export const SkipClinicCheck = () => SetMetadata(SKIP_CLINIC_CHECK_KEY, true);

/**
 * Guard to ensure multi-tenant isolation
 * Validates that resources belong to user's clinic
 * 
 * Usage: Apply to controllers/endpoints that need clinic-based filtering
 * The guard ensures clinicId is present and accessible
 */
@Injectable()
export class ClinicContextGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if endpoint explicitly skips clinic check
    const skipCheck = this.reflector.getAllAndOverride<boolean>(SKIP_CLINIC_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User tidak terautentikasi',
        },
      });
    }

    // Validate that user has clinicId (should be set during registration)
    if (!user.clinicId) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'NO_CLINIC_ASSIGNED',
          message: 'User belum terdaftar di klinik manapun',
        },
      });
    }

    // Store clinicId in request for easy access in controllers/services
    request.clinicId = user.clinicId;

    return true;
  }
}
