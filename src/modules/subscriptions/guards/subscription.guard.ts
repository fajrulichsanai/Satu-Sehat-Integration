import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from '../../../enums';
import {
  ClinicSubscription,
  ClinicSubscriptionStatus,
} from '../entities/clinic-subscription.entity';

export const SKIP_SUBSCRIPTION_CHECK_KEY = 'skipSubscriptionCheck';

/**
 * Marks a controller/route as exempt from the subscription gate — used for
 * the subscription/payment endpoints themselves (a clinic must be able to
 * view plans and submit a payment claim even while expired).
 */
export const SkipSubscriptionCheck = () =>
  SetMetadata(SKIP_SUBSCRIPTION_CHECK_KEY, true);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Global mutation gate: once a clinic's subscription lapses, every write
 * (POST/PUT/PATCH/DELETE) across the app is rejected with SUBSCRIPTION_EXPIRED
 * so the frontend can show the renew-popup, while reads keep working (view-only
 * access is intentional — see project plan). SUPER_ADMIN and skip-marked routes
 * bypass entirely.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(ClinicSubscription)
    private readonly clinicSubscriptionRepository: Repository<ClinicSubscription>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean>(
      SKIP_SUBSCRIPTION_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) return true;

    const request = context.switchToHttp().getRequest();
    if (SAFE_METHODS.has(request.method)) return true;

    const user = request.user;
    if (!user || user.role === UserRole.SUPER_ADMIN || !user.clinicId)
      return true;

    const current = await this.clinicSubscriptionRepository.findOne({
      where: { clinicId: user.clinicId },
      order: { id: 'DESC' },
    });

    const isActive =
      current &&
      current.status === ClinicSubscriptionStatus.ACTIVE &&
      new Date(current.endDate) >= new Date(new Date().toDateString());

    if (!isActive) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: 'SUBSCRIPTION_EXPIRED',
            message:
              'Langganan klinik telah berakhir. Silakan perpanjang untuk melanjutkan.',
          },
        },
        402,
      );
    }

    return true;
  }
}
