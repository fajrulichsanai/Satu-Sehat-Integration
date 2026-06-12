import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from '../../entities/encounter.entity';
import { Billing } from '../../entities/billing.entity';
import { Payment } from '../../entities/payment.entity';
import { SatusehatSyncLog } from '../../entities/satusehat-sync-log.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([Encounter, Billing, Payment, SatusehatSyncLog])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
