import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Diagnosis } from '../../diagnoses/entities/diagnosis.entity';
import { Procedure } from '../../procedures/entities/procedure.entity';
import { VitalSign } from '../../vital-sign/entities/vital-sign.entity';
import { Prescription } from '../../prescription/entities/prescription.entity';
import { Allergy } from '../../allergy/entities/allergy.entity';
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
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(Procedure)
    private readonly procedureRepo: Repository<Procedure>,
    @InjectRepository(VitalSign)
    private readonly vitalSignRepo: Repository<VitalSign>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,
    @InjectRepository(Allergy)
    private readonly allergyRepo: Repository<Allergy>,
    @InjectRepository(Clinic) private readonly clinicRepo: Repository<Clinic>,
    @InjectRepository(SatusehatSyncLog)
    private readonly syncLogRepo: Repository<SatusehatSyncLog>,
    private readonly satusehatClient: SatusehatClientService,
  ) {}

  /** Triggered when encounter status changes to FINISHED */
  async syncEncounterOnFinish(
    encounterId: number,
    clinicId: number,
  ): Promise<void> {
    try {
      await this.syncResource('Encounter', encounterId, clinicId);
      await this.syncResource('Patient', encounterId, clinicId);

      const diagnoses = await this.diagnosisRepo.find({
        where: { encounterId },
      });
      for (const d of diagnoses) {
        await this.syncResource('Condition', d.id, clinicId);
      }

      const procedures = await this.procedureRepo.find({
        where: { encounterId },
      });
      for (const p of procedures) {
        await this.syncResource('Procedure', p.id, clinicId);
      }

      const vitalSigns = await this.vitalSignRepo.find({
        where: { encounterId },
      });
      for (const vs of vitalSigns) {
        await this.syncResource('Observation', vs.id, clinicId);
      }

      const prescriptions = await this.prescriptionRepo.find({
        where: { encounterId },
      });
      for (const rx of prescriptions) {
        await this.syncResource('MedicationRequest', rx.id, clinicId);
      }
    } catch (err) {
      this.logger.error(
        `Sync on finish failed for encounter ${encounterId}: ${err.message}`,
      );
    }
  }

  /** Manual sync for a single resource */
  async syncResource(
    resourceType: string,
    localId: number,
    clinicId: number,
  ): Promise<{ success: boolean; satusehatId?: string; error?: string }> {
    return {
      success: false,
      error: 'SATUSEHAT integration has been deprecated and is no longer available',
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
      case 'Condition':
        await this.diagnosisRepo.update(localId, {
          satusehatConditionId: satusehatId,
          syncStatus: SyncStatus.SYNCED,
        });
        break;
      case 'Procedure':
        await this.procedureRepo.update(localId, {
          satusehatProcedureId: satusehatId,
          syncStatus: SyncStatus.SYNCED,
        });
        break;
      case 'MedicationRequest':
        await this.prescriptionRepo.update(localId, {
          satusehatMedreqId: satusehatId,
          syncStatus: SyncStatus.SYNCED,
        });
        break;
    }
  }
}
