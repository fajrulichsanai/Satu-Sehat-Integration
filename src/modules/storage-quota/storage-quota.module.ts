import { Global, Module, OnApplicationBootstrap } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageUsage } from './storage-usage.entity';
import { StorageQuotaService } from './storage-quota.service';
import { StorageReconcileService } from './storage-reconcile.service';
import { StorageQuotaController } from './storage-quota.controller';

/**
 * Global so any module that stores service files can meter them without
 * wiring an import each time.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([StorageUsage])],
  controllers: [StorageQuotaController],
  providers: [StorageQuotaService, StorageReconcileService],
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
