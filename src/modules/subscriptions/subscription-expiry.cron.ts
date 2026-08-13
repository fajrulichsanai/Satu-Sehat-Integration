import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClinicSubscriptionsService } from './clinic-subscriptions.service';
import { SubscriptionNotificationsService } from './subscription-notifications.service';

@Injectable()
export class SubscriptionExpiryCron {
  private readonly logger = new Logger(SubscriptionExpiryCron.name);

  constructor(
    private readonly clinicSubscriptionsService: ClinicSubscriptionsService,
    private readonly notificationsService: SubscriptionNotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleExpiry(): Promise<void> {
    const count =
      await this.clinicSubscriptionsService.expireLapsedSubscriptions();
    if (count > 0) {
      this.logger.log(`Auto-expired ${count} clinic subscription(s)`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleUpcomingExpiryReminders(): Promise<void> {
    const { h7Sent, h1Sent } =
      await this.notificationsService.sendUpcomingExpiryReminders();
    if (h7Sent + h1Sent > 0) {
      this.logger.log(
        `Sent expiry reminders: ${h7Sent} at H-7, ${h1Sent} at H-1`,
      );
    }
  }
}
