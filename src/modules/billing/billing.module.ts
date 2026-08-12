import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Billing } from './entities/billing.entity';
import { BillingItem } from '../billing-item/entities/billing-item.entity';
import { Tarif } from '../tarif/entities/tarif.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { BillingController } from './billing.controller';
import { BillingsService } from './billings.service';
import { PaymentsService } from '../payments/payments.service';
import { TarifsService } from './tarifs.service';
import { InvoiceService } from './invoice.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { GudangModule } from '../gudang/gudang.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Billing, BillingItem, Tarif, Payment, Encounter]),
    AuditLogModule,
    GudangModule,
  ],
  controllers: [BillingController],
  providers: [BillingsService, PaymentsService, TarifsService, InvoiceService],
  exports: [BillingsService],
})
export class BillingModule {}
