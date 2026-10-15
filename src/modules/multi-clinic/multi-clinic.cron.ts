import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MultiClinicService } from './multi-clinic.service';

@Injectable()
export class MultiClinicCron {
  private readonly logger = new Logger(MultiClinicCron.name);

  constructor(private readonly multiClinicService: MultiClinicService) {}

  /** PS-02: permintaan hubungan yang tidak dijawab 90 hari → kedaluwarsa. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async expireStaleRequests(): Promise<void> {
    try {
      const count = await this.multiClinicService.expireStaleRequests();
      if (count > 0) {
        this.logger.log(`${count} permintaan hubungan multiklinik kedaluwarsa`);
      }
    } catch (error) {
      this.logger.error(
        `Gagal menandai permintaan kedaluwarsa: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
