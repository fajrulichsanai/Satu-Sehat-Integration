import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { ClinicSubscription } from './entities/clinic-subscription.entity';
import { SubscriptionPayment } from './entities/subscription-payment.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { SubscriptionPlansService } from './subscription-plans.service';
import { ClinicSubscriptionsService } from './clinic-subscriptions.service';
import { SubscriptionPaymentsService } from './subscription-payments.service';
import { SuperAdminReportsService } from './super-admin-reports.service';
import { SubscriptionPlansController } from './subscription-plans.controller';
import { ClinicSubscriptionsController } from './clinic-subscriptions.controller';
import { SubscriptionPaymentsController } from './subscription-payments.controller';
import { SuperAdminReportsController } from './super-admin-reports.controller';
import { SubscriptionGuard } from './guards/subscription.guard';
import { SubscriptionExpiryCron } from './subscription-expiry.cron';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubscriptionPlan,
      ClinicSubscription,
      SubscriptionPayment,
      Clinic,
    ]),
    AuditLogModule,
  ],
  controllers: [
    SubscriptionPlansController,
    ClinicSubscriptionsController,
    SubscriptionPaymentsController,
    SuperAdminReportsController,
  ],
  providers: [
    SubscriptionPlansService,
    ClinicSubscriptionsService,
    SubscriptionPaymentsService,
    SuperAdminReportsService,
    SubscriptionGuard,
    SubscriptionExpiryCron,
  ],
  exports: [ClinicSubscriptionsService, SubscriptionGuard],
})
export class SubscriptionsModule {}
