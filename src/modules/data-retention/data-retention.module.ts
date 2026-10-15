import { Module } from '@nestjs/common';
import { StorageModule } from '../../common/storage/storage.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { FeaturesModule } from '../features/features.module';
import { ClinicDataExportService } from './clinic-data-export.service';
import { DataRetentionService } from './data-retention.service';
import { DataRetentionController } from './data-retention.controller';
import { DataRetentionCron } from './data-retention.cron';

@Module({
  imports: [StorageModule, AuditLogModule, FeaturesModule],
  controllers: [DataRetentionController],
  providers: [ClinicDataExportService, DataRetentionService, DataRetentionCron],
  exports: [DataRetentionService],
})
export class DataRetentionModule {}
