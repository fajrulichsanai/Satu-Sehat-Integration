import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from '../encounters/entities/encounter.entity';
import { Billing } from '../billing/entities/billing.entity';
import { Payment } from '../payments/entities/payment.entity';
import { SatusehatSyncLog } from '../satusehat/sync/entities/satusehat-sync-log.entity';
import { BillingItem } from '../billing-item/entities/billing-item.entity';
import { DoctorFeeConfig } from '../doctor-fee/entities/doctor-fee-config.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Encounter,
      Billing,
      Payment,
      SatusehatSyncLog,
      BillingItem,
      DoctorFeeConfig,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
