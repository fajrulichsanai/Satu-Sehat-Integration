import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Guard to ensure user account is active
 * Prevents pending/deactivated users from accessing resources
 */
@Injectable()
export class IsActiveGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();

    console.log(`IsActiveGuard: Checking if user ${user?.userId} is active`);

    if (!user) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User tidak terautentikasi',
        },
      });
    }

    // This check is redundant if JWT strategy already validates isActive,
    // but provides explicit guard for critical endpoints
    if (!user.isActive) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'ACCOUNT_NOT_ACTIVE',
          message: 'Akun Anda belum diaktivasi. Hubungi owner klinik.',
        },
      });
    }

    return true;
  }
}
