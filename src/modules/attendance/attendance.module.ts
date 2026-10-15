import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { Clinic } from '../clinics/entities/clinic.entity';
import { User } from '../users/entities/user.entity';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { AttendanceConfigService } from './attendance-config.service';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { AttendanceDevice } from './entities/attendance-device.entity';
import { AttendanceSetting } from './entities/attendance-setting.entity';
import { WorkSchedule } from './entities/work-schedule.entity';

@Module({
  imports: [
    AuditLogModule,
    TypeOrmModule.forFeature([
      AttendanceRecord,
      AttendanceDevice,
      AttendanceSetting,
      WorkSchedule,
      Clinic,
      User,
    ]),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, AttendanceConfigService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
