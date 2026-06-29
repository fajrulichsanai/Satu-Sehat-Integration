import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationalRecordsController } from './operational-records.controller';
import { OperationalRecordsService } from './operational-records.service';
import { OperationalRecord } from './entities/operational-record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OperationalRecord])],
  controllers: [OperationalRecordsController],
  providers: [OperationalRecordsService],
  exports: [OperationalRecordsService],
})
export class OperationalRecordsModule {}
