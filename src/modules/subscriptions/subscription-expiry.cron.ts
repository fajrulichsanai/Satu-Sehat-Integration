import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClinicSubscriptionsService } from './clinic-subscriptions.service';

@Injectable()
export class SubscriptionExpiryCron {
  private readonly logger = new Logger(SubscriptionExpiryCron.name);

  constructor(
    private readonly clinicSubscriptionsService: ClinicSubscriptionsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleExpiry(): Promise<void> {
    const count =
      await this.clinicSubscriptionsService.expireLapsedSubscriptions();
    if (count > 0) {
      this.logger.log(`Auto-expired ${count} clinic subscription(s)`);
    }
  }
}
