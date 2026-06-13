import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { SatusehatSyncLog, SyncLogStatus } from './entities/satusehat-sync-log.entity';
import { SyncOrchestratorService } from './sync-orchestrator.service';

const MAX_RETRY_ATTEMPTS = 5;
const BASE_DELAY_MS = 60_000; // 1 minute

@Injectable()
export class SyncQueueService {
  private readonly logger = new Logger(SyncQueueService.name);
  private processing = false;

  constructor(
    @InjectRepository(SatusehatSyncLog)
    private readonly syncLogRepo: Repository<SatusehatSyncLog>,
    private readonly orchestrator: SyncOrchestratorService,
  ) {}

  /** Process all pending/retryable failed items */
  async processPending(): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.processing) {
      this.logger.log('Sync queue already processing, skipping');
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.processing = true;
    let processed = 0, succeeded = 0, failed = 0;

    try {
      const items = await this.syncLogRepo.find({
        where: { status: SyncLogStatus.PENDING },
        order: { createdAt: 'ASC' },
        take: 100,
      });

      for (const item of items) {
        if (item.retryCount >= MAX_RETRY_ATTEMPTS) {
          await this.syncLogRepo.update(item.id, { status: SyncLogStatus.FAILED });
          failed++;
          continue;
        }

        // Exponential backoff: skip if not yet due
        if (item.lastRetryAt) {
          const delayMs = BASE_DELAY_MS * Math.pow(2, item.retryCount);
          const nextRetryAt = new Date(item.lastRetryAt.getTime() + delayMs);
          if (new Date() < nextRetryAt) continue;
        }

        try {
          const result = await this.orchestrator.syncResource(
            item.resourceType,
            item.localId,
            item.clinicId,
          );

          if (result.success) {
            succeeded++;
          } else {
            await this.syncLogRepo.update(item.id, {
              retryCount: item.retryCount + 1,
              lastRetryAt: new Date(),
              errorMessage: result.error,
            });
            failed++;
          }
          processed++;
        } catch (err) {
          this.logger.error(`Retry failed for ${item.resourceType}#${item.localId}: ${err.message}`);
          await this.syncLogRepo.update(item.id, {
            retryCount: item.retryCount + 1,
            lastRetryAt: new Date(),
            errorMessage: err.message,
          });
          failed++;
          processed++;
        }
      }
    } finally {
      this.processing = false;
    }

    this.logger.log(`Sync queue processed: ${processed} items, ${succeeded} succeeded, ${failed} failed`);
    return { processed, succeeded, failed };
  }

  /** Queue a specific item for retry */
  async enqueueRetry(clinicId: number, resourceType: string, localId: number): Promise<void> {
    await this.syncLogRepo.update(
      { clinicId, resourceType, localId, status: SyncLogStatus.FAILED },
      { status: SyncLogStatus.PENDING, lastRetryAt: new Date() },
    );
  }
}
