import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encounter } from '../../../entities/encounter.entity';
import { Patient } from '../../../entities/patient.entity';
import { Diagnosis } from '../../../entities/diagnosis.entity';
import { Procedure } from '../../../entities/procedure.entity';
import { VitalSign } from '../../../entities/vital-sign.entity';
import { Prescription } from '../../../entities/prescription.entity';
import { Allergy } from '../../../entities/allergy.entity';
import { Clinic } from '../../../entities/clinic.entity';
import { SatusehatSyncLog, SyncLogStatus, SyncOperation } from '../../../entities/satusehat-sync-log.entity';
import { SyncStatus } from '../../../enums/sync-status.enum';
import { SatusehatClientService } from '../satusehat-client.service';
import { FhirMapper } from '../fhir/fhir-mapper';

@Injectable()
export class SyncOrchestratorService {
  private readonly logger = new Logger(SyncOrchestratorService.name);

  constructor(
    @InjectRepository(Encounter) private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(Patient) private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Diagnosis) private readonly diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(Procedure) private readonly procedureRepo: Repository<Procedure>,
    @InjectRepository(VitalSign) private readonly vitalSignRepo: Repository<VitalSign>,
    @InjectRepository(Prescription) private readonly prescriptionRepo: Repository<Prescription>,
    @InjectRepository(Allergy) private readonly allergyRepo: Repository<Allergy>,
    @InjectRepository(Clinic) private readonly clinicRepo: Repository<Clinic>,
    @InjectRepository(SatusehatSyncLog) private readonly syncLogRepo: Repository<SatusehatSyncLog>,
    private readonly satusehatClient: SatusehatClientService,
  ) {}

  /** Triggered when encounter status changes to FINISHED */
  async syncEncounterOnFinish(encounterId: number, clinicId: number): Promise<void> {
    try {
      await this.syncResource('Encounter', encounterId, clinicId);
      await this.syncResource('Patient', encounterId, clinicId);

      const diagnoses = await this.diagnosisRepo.find({ where: { encounterId } });
      for (const d of diagnoses) {
        await this.syncResource('Condition', d.id, clinicId);
      }

      const procedures = await this.procedureRepo.find({ where: { encounterId } });
      for (const p of procedures) {
        await this.syncResource('Procedure', p.id, clinicId);
      }

      const vitalSigns = await this.vitalSignRepo.find({ where: { encounterId } });
      for (const vs of vitalSigns) {
        await this.syncResource('Observation', vs.id, clinicId);
      }

      const prescriptions = await this.prescriptionRepo.find({ where: { encounterId } });
      for (const rx of prescriptions) {
        await this.syncResource('MedicationRequest', rx.id, clinicId);
      }
    } catch (err) {
      this.logger.error(`Sync on finish failed for encounter ${encounterId}: ${err.message}`);
    }
  }

  /** Manual sync for a single resource */
  async syncResource(resourceType: string, localId: number, clinicId: number): Promise<{ success: boolean; satusehatId?: string; error?: string }> {
    const clinic = await this.clinicRepo.findOne({ where: { id: clinicId } });
    if (!clinic?.satusehatOrgId) {
      return { success: false, error: 'Konfigurasi SATUSEHAT tidak lengkap' };
    }

    let fhirResource: object;
    let fhirPath: string;

    try {
      switch (resourceType) {
        case 'Patient': {
          const enc = await this.encounterRepo.findOne({ where: { id: localId, clinicId }, relations: { patient: true } });
          if (!enc?.patient) return { success: false, error: 'Pasien tidak ditemukan' };
          fhirResource = FhirMapper.toFhirPatient(enc.patient, clinic.satusehatOrgId);
          fhirPath = enc.patient.satusehatPatientId ? `Patient/${enc.patient.satusehatPatientId}` : 'Patient';
          break;
        }
        case 'Encounter': {
          const enc = await this.encounterRepo.findOne({ where: { id: localId, clinicId }, relations: { patient: true, location: true } });
          if (!enc) return { success: false, error: 'Encounter tidak ditemukan' };
          fhirResource = FhirMapper.toFhirEncounter(enc, clinic.satusehatOrgId, enc.location?.satusehatLocationId);
          fhirPath = enc.satusehatEncounterId ? `Encounter/${enc.satusehatEncounterId}` : 'Encounter';
          break;
        }
        case 'Condition': {
          const diagnosis = await this.diagnosisRepo.findOne({ where: { id: localId } });
          if (!diagnosis) return { success: false, error: 'Diagnosis tidak ditemukan' };
          const enc = await this.encounterRepo.findOne({ where: { id: diagnosis.encounterId, clinicId } });
          if (!enc?.satusehatEncounterId) return { success: false, error: 'Encounter belum di-sync' };
          fhirResource = FhirMapper.toFhirCondition(diagnosis, String(enc.patientId), enc.satusehatEncounterId);
          fhirPath = diagnosis.satusehatConditionId ? `Condition/${diagnosis.satusehatConditionId}` : 'Condition';
          break;
        }
        case 'Procedure': {
          const proc = await this.procedureRepo.findOne({ where: { id: localId } });
          if (!proc) return { success: false, error: 'Prosedur tidak ditemukan' };
          const enc = await this.encounterRepo.findOne({ where: { id: proc.encounterId, clinicId } });
          if (!enc?.satusehatEncounterId) return { success: false, error: 'Encounter belum di-sync' };
          fhirResource = FhirMapper.toFhirProcedure(proc, String(enc.patientId), enc.satusehatEncounterId);
          fhirPath = proc.satusehatProcedureId ? `Procedure/${proc.satusehatProcedureId}` : 'Procedure';
          break;
        }
        case 'Observation': {
          const vs = await this.vitalSignRepo.findOne({ where: { id: localId } });
          if (!vs) return { success: false, error: 'Vital sign tidak ditemukan' };
          const enc = await this.encounterRepo.findOne({ where: { id: vs.encounterId, clinicId } });
          if (!enc?.satusehatEncounterId) return { success: false, error: 'Encounter belum di-sync' };
          fhirResource = FhirMapper.toFhirObservation(vs, String(enc.patientId), enc.satusehatEncounterId);
          fhirPath = 'Observation';
          break;
        }
        case 'MedicationRequest': {
          const rx = await this.prescriptionRepo.findOne({ where: { id: localId } });
          if (!rx) return { success: false, error: 'Resep tidak ditemukan' };
          const enc = await this.encounterRepo.findOne({ where: { id: rx.encounterId, clinicId } });
          if (!enc?.satusehatEncounterId) return { success: false, error: 'Encounter belum di-sync' };
          fhirResource = FhirMapper.toFhirMedicationRequest(rx, String(enc.patientId), enc.satusehatEncounterId, clinic.satusehatOrgId);
          fhirPath = rx.satusehatMedreqId ? `MedicationRequest/${rx.satusehatMedreqId}` : 'MedicationRequest';
          break;
        }
        default:
          return { success: false, error: `Resource type '${resourceType}' tidak dikenali` };
      }

      const isUpdate = fhirPath.includes('/');
      const { status, data } = await this.satusehatClient.sendFhirResource(
        clinicId,
        isUpdate ? 'PUT' : 'POST',
        fhirPath,
        fhirResource,
      );

      const success = status >= 200 && status < 300;
      const satusehatId = data?.id;

      await this.saveLog(clinicId, resourceType, localId, satusehatId, status, fhirResource, data, success ? undefined : JSON.stringify(data));

      if (success) {
        await this.updateSatusehatId(resourceType, localId, satusehatId);
      }

      return success ? { success: true, satusehatId } : { success: false, error: JSON.stringify(data) };
    } catch (err) {
      await this.saveLog(clinicId, resourceType, localId, undefined, undefined, fhirResource!, undefined, err.message);
      return { success: false, error: err.message };
    }
  }

  private async saveLog(
    clinicId: number, resourceType: string, localId: number,
    satusehatId?: string, httpStatus?: number, requestPayload?: object,
    responsePayload?: object, errorMessage?: string,
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

  private async updateSatusehatId(resourceType: string, localId: number, satusehatId: string): Promise<void> {
    if (!satusehatId) return;
    switch (resourceType) {
      case 'Encounter':
        await this.encounterRepo.update(localId, { satusehatEncounterId: satusehatId, syncStatus: SyncStatus.SYNCED });
        break;
      case 'Condition':
        await this.diagnosisRepo.update(localId, { satusehatConditionId: satusehatId, syncStatus: SyncStatus.SYNCED });
        break;
      case 'Procedure':
        await this.procedureRepo.update(localId, { satusehatProcedureId: satusehatId, syncStatus: SyncStatus.SYNCED });
        break;
      case 'MedicationRequest':
        await this.prescriptionRepo.update(localId, { satusehatMedreqId: satusehatId, syncStatus: SyncStatus.SYNCED });
        break;
    }
  }
}
