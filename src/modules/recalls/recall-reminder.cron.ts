import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecallNotificationsService } from './recall-notifications.service';

@Injectable()
export class RecallReminderCron {
  private readonly logger = new Logger(RecallReminderCron.name);

  constructor(
    private readonly notificationsService: RecallNotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async handleH1Reminders(): Promise<void> {
    const sent = await this.notificationsService.sendH1Reminders();
    if (sent > 0) {
      this.logger.log(
        `Sent recall H-1 reminders for ${sent} patient recall(s)`,
      );
    }
  }
}
