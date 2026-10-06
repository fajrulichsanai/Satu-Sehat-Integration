import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeaturesService } from './features.service';
import { REQUIRE_FEATURE_KEY } from './require-feature.decorator';

/** Guard global: menolak endpoint fitur yang dimatikan super admin / owner. */
@Injectable()
export class FeatureAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly features: FeaturesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<string | undefined>(
      REQUIRE_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!key) return true;
    const user = context.switchToHttp().getRequest().user;
    if (!user) return true; // endpoint publik — JWT guard yang menentukan
    if (await this.features.isExplicitlyDisabled(user, key)) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'FEATURE_DISABLED',
          message: 'Fitur ini tidak diaktifkan untuk akun atau klinik Anda',
        },
      });
    }
    return true;
  }
}
