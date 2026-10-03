import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorFeeController } from './doctor-fee.controller';
import { DoctorFeeService } from './doctor-fee.service';
import { DoctorFeeConfig } from './entities/doctor-fee-config.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([DoctorFeeConfig]), AuditLogModule],
  controllers: [DoctorFeeController],
  providers: [DoctorFeeService],
  exports: [DoctorFeeService],
})
export class DoctorFeeModule {}
