import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SyncOrchestratorService } from '../sync/sync-orchestrator.service';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { SatusehatSyncLog } from '../sync/entities/satusehat-sync-log.entity';
import { SatusehatClientService } from '../satusehat-client.service';

describe('SyncOrchestratorService (deprecated stub)', () => {
  let service: SyncOrchestratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncOrchestratorService,
        { provide: getRepositoryToken(Encounter), useValue: {} },
        { provide: getRepositoryToken(Patient), useValue: {} },
        { provide: getRepositoryToken(Clinic), useValue: {} },
        { provide: getRepositoryToken(SatusehatSyncLog), useValue: {} },
        { provide: SatusehatClientService, useValue: {} },
      ],
    }).compile();

    service = module.get<SyncOrchestratorService>(SyncOrchestratorService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('always reports failure since the integration is deprecated (negative)', async () => {
    const result = await service.syncResource('Encounter', 1, 1);
    expect(result.success).toBe(false);
    expect(result.error).toContain('deprecated');
  });
});
