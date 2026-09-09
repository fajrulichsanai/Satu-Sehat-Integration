import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SyncQueueService } from '../sync/sync-queue.service';
import { SatusehatSyncLog, SyncLogStatus } from '../sync/entities/satusehat-sync-log.entity';
import { SyncOrchestratorService } from '../sync/sync-orchestrator.service';

describe('SyncQueueService', () => {
  let service: SyncQueueService;
  let repo: { find: jest.Mock; update: jest.Mock };
  let orchestrator: { syncResource: jest.Mock };

  beforeEach(async () => {
    repo = { find: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue(undefined) };
    orchestrator = { syncResource: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncQueueService,
        { provide: getRepositoryToken(SatusehatSyncLog), useValue: repo },
        { provide: SyncOrchestratorService, useValue: orchestrator },
      ],
    }).compile();

    service = module.get<SyncQueueService>(SyncQueueService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('marks an item permanently FAILED once it hits the max retry count (positive)', async () => {
    repo.find.mockResolvedValue([
      { id: 1, retryCount: 5, resourceType: 'Encounter', localId: 1, clinicId: 1 },
    ]);

    const result = await service.processPending();

    expect(repo.update).toHaveBeenCalledWith(1, { status: SyncLogStatus.FAILED });
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 1 });
    expect(orchestrator.syncResource).not.toHaveBeenCalled();
  });

  it('counts a successful resync as succeeded (positive)', async () => {
    repo.find.mockResolvedValue([
      { id: 1, retryCount: 0, resourceType: 'Encounter', localId: 1, clinicId: 1, lastRetryAt: null },
    ]);
    orchestrator.syncResource.mockResolvedValue({ success: true });

    const result = await service.processPending();

    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
  });

  it('increments retryCount and records the error on a failed resync (negative)', async () => {
    repo.find.mockResolvedValue([
      { id: 1, retryCount: 1, resourceType: 'Encounter', localId: 1, clinicId: 1, lastRetryAt: null },
    ]);
    orchestrator.syncResource.mockResolvedValue({ success: false, error: 'boom' });

    const result = await service.processPending();

    expect(repo.update).toHaveBeenCalledWith(1, expect.objectContaining({
      retryCount: 2,
      errorMessage: 'boom',
    }));
    expect(result.failed).toBe(1);
  });

  it('treats a thrown exception from the orchestrator the same as a failed resync (negative)', async () => {
    repo.find.mockResolvedValue([
      { id: 1, retryCount: 0, resourceType: 'Encounter', localId: 1, clinicId: 1, lastRetryAt: null },
    ]);
    orchestrator.syncResource.mockRejectedValue(new Error('network blip'));

    const result = await service.processPending();

    expect(repo.update).toHaveBeenCalledWith(1, expect.objectContaining({
      errorMessage: 'network blip',
    }));
    expect(result).toEqual({ processed: 1, succeeded: 0, failed: 1 });
  });

  it('skips an item whose exponential backoff window has not elapsed yet (edge)', async () => {
    repo.find.mockResolvedValue([
      {
        id: 1,
        retryCount: 1,
        resourceType: 'Encounter',
        localId: 1,
        clinicId: 1,
        lastRetryAt: new Date(), // just retried, backoff = 2 min, not due yet
      },
    ]);

    const result = await service.processPending();

    expect(orchestrator.syncResource).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
  });

  it('retries an item once its backoff window has elapsed (edge)', async () => {
    repo.find.mockResolvedValue([
      {
        id: 1,
        retryCount: 0,
        resourceType: 'Encounter',
        localId: 1,
        clinicId: 1,
        lastRetryAt: new Date(Date.now() - 61_000), // 61s ago, backoff base is 60s * 2^0
      },
    ]);
    orchestrator.syncResource.mockResolvedValue({ success: true });

    const result = await service.processPending();

    expect(orchestrator.syncResource).toHaveBeenCalled();
    expect(result.succeeded).toBe(1);
  });

  it('does not run concurrently — a second call while processing is a no-op (negative/edge)', async () => {
    let resolveFind: (v: any) => void;
    repo.find.mockReturnValue(
      new Promise((resolve) => {
        resolveFind = resolve;
      }),
    );

    const firstCall = service.processPending();
    const secondCall = await service.processPending();

    expect(secondCall).toEqual({ processed: 0, succeeded: 0, failed: 0 });

    resolveFind!([]);
    await firstCall;
  });

  describe('enqueueRetry', () => {
    it('moves a FAILED item back to PENDING (positive)', async () => {
      await service.enqueueRetry(1, 'Encounter', 5);
      expect(repo.update).toHaveBeenCalledWith(
        { clinicId: 1, resourceType: 'Encounter', localId: 5, status: SyncLogStatus.FAILED },
        expect.objectContaining({ status: SyncLogStatus.PENDING }),
      );
    });
  });
});
