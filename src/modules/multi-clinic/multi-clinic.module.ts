import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnerClinicLink } from './entities/owner-clinic-link.entity';
import { User } from '../users/entities/user.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { MultiClinicService } from './multi-clinic.service';
import { MultiClinicController } from './multi-clinic.controller';
import { ClinicLinksController } from './clinic-links.controller';
import { MultiClinicMailService } from './multi-clinic-mail.service';
import { MultiClinicCron } from './multi-clinic.cron';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OwnerClinicLink, User, Clinic]),
    DashboardModule,
    ClinicsModule,
    SubscriptionsModule,
    AuditLogModule,
  ],
  controllers: [MultiClinicController, ClinicLinksController],
  providers: [MultiClinicService, MultiClinicMailService, MultiClinicCron],
  exports: [MultiClinicService],
})
export class MultiClinicModule {}
