import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { UserRole } from '../../../enums';
import { ClinicSubscription } from '../entities/clinic-subscription.entity';

export const SKIP_SUBSCRIPTION_CHECK_KEY = 'skipSubscriptionCheck';

/**
 * Marks a controller/route as exempt from the subscription gate — used for
 * the subscription/payment endpoints themselves (a clinic must be able to
 * view plans and submit a payment claim even while expired).
 */
export const SkipSubscriptionCheck = () =>
  SetMetadata(SKIP_SUBSCRIPTION_CHECK_KEY, true);

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEFAULT_GRACE_PERIOD_DAYS = 3;

/**
 * Global mutation gate: once a clinic's subscription lapses, every write
 * (POST/PUT/PATCH/DELETE) across the app is rejected with SUBSCRIPTION_EXPIRED
 * so the frontend can show the renew-popup, while reads keep working (view-only
 * access is intentional — see project plan). SUPER_ADMIN and skip-marked routes
 * bypass entirely.
 *
 * A grace period (SUBSCRIPTION_GRACE_PERIOD_DAYS, default 3) keeps mutations
 * working for a few days past endDate — the cron already flips status to
 * EXPIRED right at endDate for reporting purposes, so this guard checks
 * endDate + grace directly rather than relying on status alone.
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
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

    const graceDays = parseInt(
      this.configService.get<string>(
        'SUBSCRIPTION_GRACE_PERIOD_DAYS',
        String(DEFAULT_GRACE_PERIOD_DAYS),
      ),
      10,
    );
    const today = new Date(new Date().toDateString());
    const graceDeadline = current
      ? new Date(`${current.endDate}T00:00:00`)
      : null;
    if (graceDeadline)
      graceDeadline.setDate(graceDeadline.getDate() + graceDays);

    const withinGrace = current && graceDeadline && graceDeadline >= today;

    if (!withinGrace) {
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
