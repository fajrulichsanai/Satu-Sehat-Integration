import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecallInterval } from './entities/recall-interval.entity';
import { PatientRecall } from './entities/patient-recall.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { User } from '../users/entities/user.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { RecallIntervalsService } from './recall-intervals.service';
import { PatientRecallsService } from './patient-recalls.service';
import { RecallNotificationsService } from './recall-notifications.service';
import { RecallIntervalsController } from './recall-intervals.controller';
import { PatientRecallsController } from './patient-recalls.controller';
import { RecallReminderCron } from './recall-reminder.cron';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RecallInterval,
      PatientRecall,
      Clinic,
      User,
      Reservation,
    ]),
    AuditLogModule,
  ],
  controllers: [RecallIntervalsController, PatientRecallsController],
  providers: [
    RecallIntervalsService,
    PatientRecallsService,
    RecallNotificationsService,
    RecallReminderCron,
  ],
  exports: [PatientRecallsService],
})
export class RecallsModule {}
