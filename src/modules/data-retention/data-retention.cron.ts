import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataRetentionService } from './data-retention.service';

@Injectable()
export class DataRetentionCron {
  private readonly logger = new Logger(DataRetentionCron.name);

  constructor(private readonly retention: DataRetentionService) {}

  // After SubscriptionExpiryCron (01:00) marks lapsed subscriptions expired.
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async run(): Promise<void> {
    try {
      const { scheduled, cancelled } = await this.retention.scheduleLapsed();
      const reminded = await this.retention.sendReminders();
      const purged = await this.retention.purgeDue();
      if (scheduled + cancelled + reminded + purged > 0) {
        this.logger.log(
          `Retensi data: ${scheduled} dijadwalkan, ${cancelled} dibatalkan, ${reminded} pengingat, ${purged} dihapus`,
        );
      }
    } catch (err) {
      this.logger.error(`Retensi data gagal: ${String(err)}`);
    }
  }
}
