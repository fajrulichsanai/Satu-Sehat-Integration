import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { ReportsModule } from '../reports/reports.module';
import { User } from '../users/entities/user.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import {
  EmployeeSalary,
  PayrollItem,
  PayrollRun,
} from './entities/payroll.entity';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';
import { PayrollPdfService } from './payroll-pdf.service';

@Module({
  imports: [
    AuditLogModule,
    AttendanceModule,
    ReportsModule,
    TypeOrmModule.forFeature([
      EmployeeSalary,
      PayrollRun,
      PayrollItem,
      User,
      Clinic,
    ]),
  ],
  controllers: [PayrollController],
  providers: [PayrollService, PayrollPdfService],
  exports: [PayrollService],
})
export class PayrollModule {}
