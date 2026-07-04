import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import {
  SatusehatSyncLog,
  SyncLogStatus,
  SyncOperation,
} from './entities/satusehat-sync-log.entity';
import { SyncStatus } from '../../../enums/sync-status.enum';
import { SatusehatClientService } from '../satusehat-client.service';
import { FhirMapper } from '../fhir/fhir-mapper';

@Injectable()
export class SyncOrchestratorService {
  private readonly logger = new Logger(SyncOrchestratorService.name);

  constructor(
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Clinic) private readonly clinicRepo: Repository<Clinic>,
    @InjectRepository(SatusehatSyncLog)
    private readonly syncLogRepo: Repository<SatusehatSyncLog>,
    private readonly satusehatClient: SatusehatClientService,
  ) {}

  /** Manual sync for a single resource */
  async syncResource(
    resourceType: string,
    localId: number,
    clinicId: number,
  ): Promise<{ success: boolean; satusehatId?: string; error?: string }> {
    return {
      success: false,
      error:
        'SATUSEHAT integration has been deprecated and is no longer available',
    };
  }

  private async saveLog(
    clinicId: number,
    resourceType: string,
    localId: number,
    satusehatId?: string,
    httpStatus?: number,
    requestPayload?: object,
    responsePayload?: object,
    errorMessage?: string,
  ): Promise<void> {
    await this.syncLogRepo.save({
      clinicId,
      resourceType,
      localId,
      satusehatId,
      operation: SyncOperation.CREATE,
      status: errorMessage ? SyncLogStatus.FAILED : SyncLogStatus.SUCCESS,
      httpStatus,
      requestPayload,
      responsePayload,
      errorMessage,
    });
  }

  private async updateSatusehatId(
    resourceType: string,
    localId: number,
    satusehatId: string,
  ): Promise<void> {
    if (!satusehatId) return;
    switch (resourceType) {
      case 'Encounter':
        await this.encounterRepo.update(localId, {
          satusehatEncounterId: satusehatId,
          syncStatus: SyncStatus.SYNCED,
        });
        break;
    }
  }
}
