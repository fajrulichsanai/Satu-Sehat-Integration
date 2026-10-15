import { Global, Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageUsage } from './storage-usage.entity';
import { StorageAddon } from './storage-addon.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { StorageQuotaService } from './storage-quota.service';
import { StorageReconcileService } from './storage-reconcile.service';
import { StorageBonusReminderService } from './storage-bonus-reminder.service';
import { StorageQuotaController } from './storage-quota.controller';

/**
 * Global so any module that stores service files can meter them without
 * wiring an import each time.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([StorageUsage, StorageAddon]),
    AuditLogModule,
  ],
  controllers: [StorageQuotaController],
  providers: [
    StorageQuotaService,
    StorageReconcileService,
    StorageBonusReminderService,
  ],
  exports: [StorageQuotaService],
})
export class StorageQuotaModule implements OnApplicationBootstrap {
  constructor(private readonly reconcile: StorageReconcileService) {}

  onApplicationBootstrap() {
    // Backfill files from before metering, without delaying startup.
    if (process.env.NODE_ENV !== 'test') {
      setTimeout(() => void this.reconcile.reconcile(), 10_000).unref();
    }
  }
}
