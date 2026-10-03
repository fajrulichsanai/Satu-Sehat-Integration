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

    const { d7Sent, d13Sent, d15Sent } =
      await this.notificationsService.sendTrialReminders();
    if (d7Sent + d13Sent + d15Sent > 0) {
      this.logger.log(
        `Sent trial reminders: ${d7Sent} at day 7, ${d13Sent} at day 13, ${d15Sent} at day 15`,
      );
    }
  }
}
