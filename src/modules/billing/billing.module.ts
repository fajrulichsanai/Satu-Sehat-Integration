import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Billing } from '../../entities/billing.entity';
import { BillingItem } from '../../entities/billing-item.entity';
import { Tarif } from '../../entities/tarif.entity';
import { Payment } from '../../entities/payment.entity';
import { RefundRequest } from '../../entities/refund-request.entity';
import { Encounter } from '../../entities/encounter.entity';
import { BillingController } from './billing.controller';
import { BillingsService } from './billings.service';
import { PaymentsService } from './payments.service';
import { RefundsService } from './refunds.service';
import { TarifsService } from './tarifs.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Billing, BillingItem, Tarif, Payment, RefundRequest, Encounter]),
  ],
  controllers: [BillingController],
  providers: [BillingsService, PaymentsService, RefundsService, TarifsService],
  exports: [BillingsService],
})
export class BillingModule {}
