import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationalRecordsController } from './operational-records.controller';
import { OperationalRecordsService } from './operational-records.service';
import { OperationalRecord } from './entities/operational-record.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([OperationalRecord]), AuditLogModule],
  controllers: [OperationalRecordsController],
  providers: [OperationalRecordsService],
  exports: [OperationalRecordsService],
})
export class OperationalRecordsModule {}
