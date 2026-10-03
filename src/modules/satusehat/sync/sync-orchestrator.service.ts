import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Diagnosis } from '../../diagnoses/entities/diagnosis.entity';
import { Procedure } from '../../procedures/entities/procedure.entity';
import { VitalSign } from '../../vital-sign/entities/vital-sign.entity';
import { Prescription } from '../../prescription/entities/prescription.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Practitioner } from '../../practitioners/entities/practitioner.entity';
import { Location } from '../../location/entities/location.entity';
import { Anamnesis } from '../../anamnesis/entities/anamnesis.entity';
import { OhisData } from '../../ohis-data/entities/ohis-data.entity';
import { Dispense } from '../../dispense/entities/dispense.entity';
import { Medication } from '../../medications/entities/medication.entity';
import {
  SatusehatSyncLog,
  SyncLogStatus,
  SyncOperation,
} from './entities/satusehat-sync-log.entity';
import { SatusehatResourceLink } from './entities/satusehat-resource-link.entity';
import { SyncStatus } from '../../../enums/sync-status.enum';
import { SatusehatClientService } from '../satusehat-client.service';
import { FhirContext, FhirMapper } from '../fhir/fhir-mapper';
import { readableFhirError } from '../fhir/fhir-error';

export interface SyncStep {
  /** Nama langkah sesuai playbook, mis. "07. Diagnosis" */
  step: string;
  resourceType: string;
  localType: string;
  localId: number;
  status: 'success' | 'failed' | 'skipped';
  satusehatId?: string;
  message?: string;
}

export interface SyncResult {
  success: boolean;
  satusehatId?: string;
  error?: string;
}

class StepError extends Error {}

/**
 * Pengiriman data kunjungan rawat jalan ke SATUSEHAT mengikuti Playbook
 * "RME Rawat Jalan" / Postman "Use Case - Gigi":
 *
 *   01 Prasyarat  : Patient & Practitioner (cari by NIK), Location (buat bila belum)
 *   02 Encounter  : POST saat kunjungan (arrived / in-progress)
 *   03 Anamnesis  : Observation golongan darah, rhesus, status kehamilan
 *   04 Pemeriksaan: Observation tanda vital, OHIS
 *   07 Diagnosis  : Condition (ICD-10)
 *   08 Tindakan   : Procedure (ICD-9-CM)
 *   09 Obat       : Medication + MedicationRequest, Medication + MedicationDispense
 *   12 Pulang     : PUT Encounter finished + diagnosis + dischargeDisposition
 */
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
    @InjectRepository(Clinic) private readonly clinicRepo: Repository<Clinic>,
    @InjectRepository(Practitioner)
    private readonly practitionerRepo: Repository<Practitioner>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(Anamnesis)
    private readonly anamnesisRepo: Repository<Anamnesis>,
    @InjectRepository(OhisData)
    private readonly ohisRepo: Repository<OhisData>,
    @InjectRepository(Dispense)
    private readonly dispenseRepo: Repository<Dispense>,
    @InjectRepository(SatusehatSyncLog)
    private readonly syncLogRepo: Repository<SatusehatSyncLog>,
    @InjectRepository(SatusehatResourceLink)
    private readonly linkRepo: Repository<SatusehatResourceLink>,
    private readonly satusehatClient: SatusehatClientService,
  ) {}

  /** Dipanggil saat kunjungan selesai (fire-and-forget dari EncountersService). */
  async syncEncounterOnFinish(
    encounterId: number,
    clinicId: number,
  ): Promise<void> {
    try {
      const clinic = await this.clinicRepo.findOne({ where: { id: clinicId } });
      if (!this.isConfigured(clinic)) return;
      const { steps } = await this.syncEncounterFull(encounterId, clinicId);
      const failed = steps.filter((s) => s.status === 'failed').length;
      this.logger.log(
        `Auto-sync encounter ${encounterId}: ${steps.length - failed} ok, ${failed} gagal`,
      );
    } catch (err) {
      this.logger.error(
        `Sync on finish failed for encounter ${encounterId}: ${(err as Error).message}`,
      );
    }
  }

  /** Kirim seluruh data satu kunjungan sesuai urutan playbook. */
  async syncEncounterFull(
    encounterId: number,
    clinicId: number,
  ): Promise<{ success: boolean; steps: SyncStep[] }> {
    const steps: SyncStep[] = [];
    const clinic = await this.clinicRepo.findOne({ where: { id: clinicId } });
    if (!clinic || !this.isConfigured(clinic)) {
      steps.push(
        this.fail(
          '00. Konfigurasi',
          'Organization',
          'clinic',
          clinicId,
          'Konfigurasi SATUSEHAT belum lengkap',
        ),
      );
      return { success: false, steps };
    }

    const encounter = await this.encounterRepo.findOne({
      where: { id: encounterId, clinicId },
      relations: { patient: true, practitioner: true, location: true },
    });
    if (!encounter) {
      steps.push(
        this.fail(
          '02. Kunjungan',
          'Encounter',
          'encounter',
          encounterId,
          'Kunjungan tidak ditemukan',
        ),
      );
      return { success: false, steps };
    }
    if (encounter.status === 'cancelled' && !encounter.satusehatEncounterId) {
      steps.push(
        this.skip(
          '02. Kunjungan',
          'Encounter',
          'encounter',
          encounterId,
          'Kunjungan dibatalkan, tidak dikirim',
        ),
      );
      return { success: true, steps };
    }

    // 01. Prasyarat
    let ctx: FhirContext;
    try {
      ctx = await this.buildContext(clinic, encounter, steps);
    } catch {
      return { success: false, steps };
    }

    // 02. Encounter (POST pertama kali, sebelum status finished)
    try {
      if (!encounter.satusehatEncounterId) {
        const initialStatus =
          encounter.status === 'finished'
            ? encounter.inProgressTime
              ? 'in_progress'
              : 'arrived'
            : encounter.status;
        const initial = FhirMapper.toEncounter(
          { ...encounter, status: initialStatus } as Encounter,
          ctx,
        );
        const id = await this.send(
          clinicId,
          'Encounter',
          encounter.id,
          initial,
        );
        encounter.satusehatEncounterId = id;
        await this.encounterRepo.update(encounter.id, {
          satusehatEncounterId: id,
          syncStatus: SyncStatus.SYNCED,
          syncError: null as unknown as string,
          lastSyncAt: new Date(),
        });
        steps.push(
          this.ok('02. Kunjungan', 'Encounter', 'encounter', encounter.id, id),
        );
      }
      ctx.encounterId = encounter.satusehatEncounterId;
    } catch (err) {
      await this.encounterRepo.update(encounter.id, {
        syncStatus: SyncStatus.FAILED,
        syncError: (err as Error).message.slice(0, 5000),
        lastSyncAt: new Date(),
      });
      steps.push(
        this.fail(
          '02. Kunjungan',
          'Encounter',
          'encounter',
          encounter.id,
          (err as Error).message,
        ),
      );
      return { success: false, steps };
    }

    // 03. Anamnesis
    const anamnesis = await this.anamnesisRepo.findOne({
      where: { encounterId },
    });
    if (anamnesis) {
      for (const { localType, resource } of FhirMapper.toAnamnesisObservations(
        anamnesis,
        ctx,
      )) {
        steps.push(
          await this.sendLinked(
            clinicId,
            '03. Anamnesis',
            'Observation',
            localType,
            anamnesis.id,
            resource,
          ),
        );
      }
    }

    // 04. Pemeriksaan fisik — tanda vital
    for (const vs of await this.vitalSignRepo.find({
      where: { encounterId },
    })) {
      steps.push(
        await this.sendLinked(
          clinicId,
          '04. Tanda Vital',
          'Observation',
          'vital_sign',
          vs.id,
          FhirMapper.toVitalSignObservation(vs, ctx),
        ),
      );
    }

    // 04. Pemeriksaan fisik — OHIS
    const ohis = await this.ohisRepo.findOne({ where: { encounterId } });
    if (ohis) {
      for (const { localType, resource } of FhirMapper.toOhisObservations(
        ohis,
        ctx,
      )) {
        steps.push(
          await this.sendLinked(
            clinicId,
            '04. OHIS',
            'Observation',
            localType,
            ohis.id,
            resource,
          ),
        );
      }
    }

    // 07. Diagnosis
    const diagnoses = await this.diagnosisRepo.find({
      where: { encounterId },
      order: { isPrimary: 'DESC', id: 'ASC' },
    });
    for (const d of diagnoses) {
      steps.push(await this.syncCondition(clinicId, d, ctx));
    }

    // 08. Tindakan
    for (const p of await this.procedureRepo.find({ where: { encounterId } })) {
      steps.push(await this.syncProcedure(clinicId, p, ctx));
    }

    // 09. Peresepan & pengeluaran obat
    for (const rx of await this.prescriptionRepo.find({
      where: { encounterId },
      relations: { medication: true },
    })) {
      steps.push(
        ...(await this.syncPrescription(clinicId, rx, encounter.id, ctx)),
      );
    }
    for (const dp of await this.dispenseRepo.find({
      where: { encounterId },
      relations: { medication: true, prescription: true },
    })) {
      steps.push(...(await this.syncDispense(clinicId, dp, encounter.id, ctx)));
    }

    // 12. Cara keluar — PUT Encounter finished dengan diagnosis
    if (encounter.status === 'finished' || encounter.status === 'cancelled') {
      try {
        const fresh = await this.diagnosisRepo.find({
          where: { encounterId },
          order: { isPrimary: 'DESC', id: 'ASC' },
        });
        const dx = fresh
          .filter(
            (d) => d.satusehatConditionId && d.category !== 'problem-list-item',
          )
          .map((d) => ({
            conditionId: d.satusehatConditionId,
            display: d.icd10Display,
          }));
        const body = FhirMapper.toEncounter(encounter, ctx, dx);
        await this.send(
          clinicId,
          'Encounter',
          encounter.id,
          body,
          encounter.satusehatEncounterId,
        );
        await this.encounterRepo.update(encounter.id, {
          syncStatus: SyncStatus.SYNCED,
          syncError: null as unknown as string,
          lastSyncAt: new Date(),
        });
        steps.push(
          this.ok(
            '12. Kunjungan Selesai',
            'Encounter',
            'encounter',
            encounter.id,
            encounter.satusehatEncounterId,
          ),
        );
      } catch (err) {
        await this.encounterRepo.update(encounter.id, {
          syncStatus: SyncStatus.FAILED,
          syncError: (err as Error).message.slice(0, 5000),
          lastSyncAt: new Date(),
        });
        steps.push(
          this.fail(
            '12. Kunjungan Selesai',
            'Encounter',
            'encounter',
            encounter.id,
            (err as Error).message,
          ),
        );
      }
    }

    return { success: steps.every((s) => s.status !== 'failed'), steps };
  }

  /**
   * Kirim satu resource (tombol "Kirim" di menu SATUSEHAT / antrean retry).
   * Encounter mengirim seluruh kunjungan.
   */
  async syncResource(
    resourceType: string,
    localId: number,
    clinicId: number,
  ): Promise<SyncResult> {
    const clinic = await this.clinicRepo.findOne({ where: { id: clinicId } });
    if (!clinic || !this.isConfigured(clinic)) {
      return { success: false, error: 'Konfigurasi SATUSEHAT tidak lengkap' };
    }

    try {
      switch (resourceType) {
        case 'Encounter': {
          const { success, steps } = await this.syncEncounterFull(
            localId,
            clinicId,
          );
          const failed = steps.filter((s) => s.status === 'failed');
          return success
            ? {
                success: true,
                satusehatId: steps.find((s) => s.resourceType === 'Encounter')
                  ?.satusehatId,
              }
            : {
                success: false,
                error: failed.map((s) => `${s.step}: ${s.message}`).join(' | '),
              };
        }
        case 'Patient': {
          const p = await this.patientRepo.findOne({
            where: { id: localId, clinicId },
          });
          if (!p) return { success: false, error: 'Pasien tidak ditemukan' };
          return {
            success: true,
            satusehatId: await this.resolvePatient(clinicId, p, true),
          };
        }
        case 'Practitioner': {
          const pr = await this.practitionerRepo.findOne({
            where: { id: localId, clinicId },
          });
          if (!pr)
            return {
              success: false,
              error: 'Tenaga kesehatan tidak ditemukan',
            };
          return {
            success: true,
            satusehatId: await this.resolvePractitioner(clinicId, pr, true),
          };
        }
        case 'Location': {
          const loc = await this.locationRepo.findOne({
            where: { id: localId, clinicId },
          });
          if (!loc) return { success: false, error: 'Lokasi tidak ditemukan' };
          return {
            success: true,
            satusehatId: await this.ensureLocation(clinic, loc, true),
          };
        }
      }

      // Resource turunan kunjungan: butuh konteks encounter yang sudah terkirim
      const encounterId = await this.findEncounterIdFor(resourceType, localId);
      if (!encounterId)
        return {
          success: false,
          error: `${resourceType} #${localId} tidak ditemukan`,
        };
      const encounter = await this.encounterRepo.findOne({
        where: { id: encounterId, clinicId },
        relations: { patient: true, practitioner: true, location: true },
      });
      if (!encounter)
        return { success: false, error: 'Kunjungan tidak ditemukan' };
      if (!encounter.satusehatEncounterId) {
        return {
          success: false,
          error:
            'Kunjungan belum dikirim ke SATUSEHAT — kirim kunjungannya dulu',
        };
      }
      const steps: SyncStep[] = [];
      let ctx: FhirContext;
      try {
        ctx = await this.buildContext(clinic, encounter, steps);
      } catch {
        return {
          success: false,
          error: steps.find((s) => s.status === 'failed')?.message,
        };
      }
      ctx.encounterId = encounter.satusehatEncounterId;

      let result: SyncStep[];
      switch (resourceType) {
        case 'Condition': {
          const d = await this.diagnosisRepo.findOneByOrFail({ id: localId });
          result = [await this.syncCondition(clinicId, d, ctx)];
          break;
        }
        case 'Procedure': {
          const p = await this.procedureRepo.findOneByOrFail({ id: localId });
          result = [await this.syncProcedure(clinicId, p, ctx)];
          break;
        }
        case 'Observation': {
          const vs = await this.vitalSignRepo.findOneByOrFail({ id: localId });
          result = [
            await this.sendLinked(
              clinicId,
              '04. Tanda Vital',
              'Observation',
              'vital_sign',
              vs.id,
              FhirMapper.toVitalSignObservation(vs, ctx),
            ),
          ];
          break;
        }
        case 'MedicationRequest': {
          const rx = await this.prescriptionRepo.findOneOrFail({
            where: { id: localId },
            relations: { medication: true },
          });
          result = await this.syncPrescription(clinicId, rx, encounter.id, ctx);
          break;
        }
        case 'MedicationDispense': {
          const dp = await this.dispenseRepo.findOneOrFail({
            where: { id: localId },
            relations: { medication: true, prescription: true },
          });
          result = await this.syncDispense(clinicId, dp, encounter.id, ctx);
          break;
        }
        default:
          return {
            success: false,
            error: `Resource type '${resourceType}' tidak dikenali`,
          };
      }
      const failed = result.find(
        (s) => s.status === 'failed' || s.status === 'skipped',
      );
      return failed
        ? { success: false, error: failed.message }
        : {
            success: true,
            satusehatId: result[result.length - 1]?.satusehatId,
          };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  // ── Prasyarat ──────────────────────────────────────────────────────────

  private async buildContext(
    clinic: Clinic,
    encounter: Encounter,
    steps: SyncStep[],
  ): Promise<FhirContext> {
    const clinicId = clinic.id;

    let patientId: string;
    try {
      patientId = await this.resolvePatient(clinicId, encounter.patient);
      steps.push(
        this.ok(
          '01. Pasien (NIK)',
          'Patient',
          'patient',
          encounter.patientId,
          patientId,
        ),
      );
    } catch (err) {
      steps.push(
        this.fail(
          '01. Pasien (NIK)',
          'Patient',
          'patient',
          encounter.patientId,
          (err as Error).message,
        ),
      );
      throw err;
    }

    let practitionerId: string;
    try {
      if (!encounter.practitioner)
        throw new StepError('Kunjungan belum memiliki dokter');
      practitionerId = await this.resolvePractitioner(
        clinicId,
        encounter.practitioner,
      );
      steps.push(
        this.ok(
          '01. Tenaga Kesehatan (NIK)',
          'Practitioner',
          'practitioner',
          encounter.practitionerId,
          practitionerId,
        ),
      );
    } catch (err) {
      steps.push(
        this.fail(
          '01. Tenaga Kesehatan (NIK)',
          'Practitioner',
          'practitioner',
          encounter.practitionerId,
          (err as Error).message,
        ),
      );
      throw err;
    }

    let location: { id: string; name: string };
    try {
      if (encounter.location) {
        location = {
          id: await this.ensureLocation(clinic, encounter.location),
          name: encounter.location.name,
        };
      } else if (clinic.satusehatPoliLocationId) {
        location = {
          id: clinic.satusehatPoliLocationId,
          name: 'Poli Gigi dan Mulut',
        };
      } else {
        throw new StepError(
          'Kunjungan tidak memiliki lokasi/ruangan dan Location Poli klinik belum dibuat',
        );
      }
      steps.push(
        this.ok(
          '01. Lokasi',
          'Location',
          'location',
          encounter.locationId ?? 0,
          location.id,
        ),
      );
    } catch (err) {
      steps.push(
        this.fail(
          '01. Lokasi',
          'Location',
          'location',
          encounter.locationId ?? 0,
          (err as Error).message,
        ),
      );
      throw err;
    }

    return {
      orgId: clinic.satusehatOrgId,
      patient: { id: patientId, name: encounter.patient.name },
      practitioner: { id: practitionerId, name: encounter.practitioner.name },
      location,
    };
  }

  /** IHS pasien dari Master Patient Index berdasarkan NIK. */
  private async resolvePatient(
    clinicId: number,
    patient: Patient,
    force = false,
  ): Promise<string> {
    if (!force && patient.satusehatPatientId) return patient.satusehatPatientId;
    try {
      if (!patient.nik)
        throw new StepError(`NIK pasien ${patient.name} kosong`);
      const bundle = await this.satusehatClient.searchPatientByNik(
        clinicId,
        patient.nik,
      );
      const id: string | undefined = bundle?.entry?.[0]?.resource?.id;
      if (!id)
        throw new StepError(`NIK ${patient.nik} tidak ditemukan di SATUSEHAT`);
      await this.patientRepo.update(patient.id, {
        satusehatPatientId: id,
        ihsNumber: id,
        syncStatus: SyncStatus.SYNCED,
        syncError: null as unknown as string,
        lastSyncAt: new Date(),
      });
      await this.saveLog(
        clinicId,
        'Patient',
        patient.id,
        id,
        200,
        undefined,
        undefined,
      );
      patient.satusehatPatientId = id;
      return id;
    } catch (err) {
      const message = (err as Error).message;
      await this.patientRepo.update(patient.id, {
        syncStatus: SyncStatus.FAILED,
        syncError: message,
        lastSyncAt: new Date(),
      });
      await this.saveLog(
        clinicId,
        'Patient',
        patient.id,
        undefined,
        undefined,
        undefined,
        undefined,
        message,
      );
      throw err;
    }
  }

  /** IHS tenaga kesehatan berdasarkan NIK. */
  private async resolvePractitioner(
    clinicId: number,
    practitioner: Practitioner,
    force = false,
  ): Promise<string> {
    if (!force && practitioner.satusehatPractitionerId)
      return practitioner.satusehatPractitionerId;
    try {
      if (!practitioner.nik)
        throw new StepError(`NIK ${practitioner.name} kosong`);
      const bundle = await this.satusehatClient.searchPractitionerByNik(
        clinicId,
        practitioner.nik,
      );
      const id: string | undefined = bundle?.entry?.[0]?.resource?.id;
      if (!id)
        throw new StepError(
          `NIK ${practitioner.nik} (${practitioner.name}) tidak ditemukan di SATUSEHAT`,
        );
      await this.practitionerRepo.update(practitioner.id, {
        satusehatPractitionerId: id,
      });
      await this.saveLog(
        clinicId,
        'Practitioner',
        practitioner.id,
        id,
        200,
        undefined,
        undefined,
      );
      practitioner.satusehatPractitionerId = id;
      return id;
    } catch (err) {
      await this.saveLog(
        clinicId,
        'Practitioner',
        practitioner.id,
        undefined,
        undefined,
        undefined,
        undefined,
        (err as Error).message,
      );
      throw err;
    }
  }

  /** Buat Location (ruangan) di SATUSEHAT bila belum ada. */
  private async ensureLocation(
    clinic: Clinic,
    location: Location,
    force = false,
  ): Promise<string> {
    if (!force && location.satusehatLocationId)
      return location.satusehatLocationId;
    const body = FhirMapper.toLocation(location, clinic.satusehatOrgId);
    const id = await this.send(
      clinic.id,
      'Location',
      location.id,
      body,
      location.satusehatLocationId || undefined,
    );
    await this.locationRepo.update(location.id, { satusehatLocationId: id });
    location.satusehatLocationId = id;
    return id;
  }

  // ── Resource klinis ────────────────────────────────────────────────────

  private async syncCondition(
    clinicId: number,
    d: Diagnosis,
    ctx: FhirContext,
  ): Promise<SyncStep> {
    const step = '07. Diagnosis';
    try {
      const id = await this.send(
        clinicId,
        'Condition',
        d.id,
        FhirMapper.toCondition(d, ctx),
        d.satusehatConditionId || undefined,
      );
      await this.diagnosisRepo.update(d.id, {
        satusehatConditionId: id,
        syncStatus: SyncStatus.SYNCED,
      });
      d.satusehatConditionId = id;
      return this.ok(step, 'Condition', 'condition', d.id, id);
    } catch (err) {
      await this.diagnosisRepo.update(d.id, { syncStatus: SyncStatus.FAILED });
      return this.fail(
        step,
        'Condition',
        'condition',
        d.id,
        (err as Error).message,
      );
    }
  }

  private async syncProcedure(
    clinicId: number,
    p: Procedure,
    ctx: FhirContext,
  ): Promise<SyncStep> {
    const step = '08. Tindakan';
    try {
      const reason = p.reasonDiagnosisId
        ? await this.diagnosisRepo.findOne({
            where: { id: p.reasonDiagnosisId },
          })
        : null;
      const id = await this.send(
        clinicId,
        'Procedure',
        p.id,
        FhirMapper.toProcedure(p, ctx, reason),
        p.satusehatProcedureId || undefined,
      );
      await this.procedureRepo.update(p.id, {
        satusehatProcedureId: id,
        syncStatus: SyncStatus.SYNCED,
      });
      return this.ok(step, 'Procedure', 'procedure', p.id, id);
    } catch (err) {
      await this.procedureRepo.update(p.id, { syncStatus: SyncStatus.FAILED });
      return this.fail(
        step,
        'Procedure',
        'procedure',
        p.id,
        (err as Error).message,
      );
    }
  }

  private async syncPrescription(
    clinicId: number,
    rx: Prescription,
    encounterLocalId: number,
    ctx: FhirContext,
  ): Promise<SyncStep[]> {
    const step = '09. Peresepan Obat';
    if (!rx.medication?.kfaCode) {
      const message = `Obat "${rx.medication?.name ?? rx.medicationId}" belum punya kode KFA — lengkapi di data obat`;
      await this.prescriptionRepo.update(rx.id, {
        syncStatus: SyncStatus.FAILED,
      });
      await this.saveLog(
        clinicId,
        'MedicationRequest',
        rx.id,
        undefined,
        undefined,
        undefined,
        undefined,
        message,
      );
      return [
        this.fail(step, 'MedicationRequest', 'prescription', rx.id, message),
      ];
    }
    const out: SyncStep[] = [];
    const med = await this.sendLinked(
      clinicId,
      step,
      'Medication',
      'rx_medication',
      rx.id,
      FhirMapper.toMedication(rx.medication, ctx, `RX-${rx.id}`),
    );
    out.push(med);
    if (med.status !== 'success') {
      await this.prescriptionRepo.update(rx.id, {
        syncStatus: SyncStatus.FAILED,
      });
      return out;
    }
    try {
      const body = FhirMapper.toMedicationRequest(
        rx,
        rx.medication,
        med.satusehatId!,
        encounterLocalId,
        ctx,
      );
      const id = await this.send(
        clinicId,
        'MedicationRequest',
        rx.id,
        body,
        rx.satusehatMedreqId || undefined,
      );
      await this.prescriptionRepo.update(rx.id, {
        satusehatMedreqId: id,
        syncStatus: SyncStatus.SYNCED,
      });
      rx.satusehatMedreqId = id;
      out.push(this.ok(step, 'MedicationRequest', 'prescription', rx.id, id));
    } catch (err) {
      await this.prescriptionRepo.update(rx.id, {
        syncStatus: SyncStatus.FAILED,
      });
      out.push(
        this.fail(
          step,
          'MedicationRequest',
          'prescription',
          rx.id,
          (err as Error).message,
        ),
      );
    }
    return out;
  }

  private async syncDispense(
    clinicId: number,
    dp: Dispense,
    encounterLocalId: number,
    ctx: FhirContext,
  ): Promise<SyncStep[]> {
    const step = '09. Pengeluaran Obat';
    const rx = dp.prescription;
    if (!rx?.satusehatMedreqId) {
      return [
        this.skip(
          step,
          'MedicationDispense',
          'dispense',
          dp.id,
          'Resep belum terkirim ke SATUSEHAT',
        ),
      ];
    }
    if (!dp.medication?.kfaCode) {
      const message = `Obat "${dp.medication?.name ?? dp.medicationId}" belum punya kode KFA`;
      await this.saveLog(
        clinicId,
        'MedicationDispense',
        dp.id,
        undefined,
        undefined,
        undefined,
        undefined,
        message,
      );
      return [
        this.fail(step, 'MedicationDispense', 'dispense', dp.id, message),
      ];
    }
    const out: SyncStep[] = [];
    const med = await this.sendLinked(
      clinicId,
      step,
      'Medication',
      'dispense_medication',
      dp.id,
      FhirMapper.toMedication(dp.medication, ctx, `DISP-${dp.id}`),
    );
    out.push(med);
    if (med.status !== 'success') return out;
    out.push(
      await this.sendLinked(
        clinicId,
        step,
        'MedicationDispense',
        'dispense',
        dp.id,
        FhirMapper.toMedicationDispense(
          dp,
          rx,
          dp.medication,
          med.satusehatId!,
          rx.satusehatMedreqId,
          encounterLocalId,
          ctx,
        ),
        'MedicationDispense',
      ),
    );
    return out;
  }

  // ── Infrastruktur kirim ────────────────────────────────────────────────

  /**
   * POST (baru) atau PUT (sudah ada) lalu catat log. Melempar Error berisi
   * pesan OperationOutcome bila SATUSEHAT menolak.
   */
  private async send(
    clinicId: number,
    resourceType: string,
    localId: number,
    body: Record<string, any>,
    existingId?: string,
    logResourceType = resourceType,
  ): Promise<string> {
    const path = existingId ? `${resourceType}/${existingId}` : resourceType;
    const payload = existingId ? { ...body, id: existingId } : body;
    let status: number | undefined;
    let data: any;
    try {
      ({ status, data } = await this.satusehatClient.sendFhirResource(
        clinicId,
        existingId ? 'PUT' : 'POST',
        path,
        payload,
      ));
    } catch (err) {
      await this.saveLog(
        clinicId,
        logResourceType,
        localId,
        undefined,
        undefined,
        payload,
        undefined,
        (err as Error).message,
        existingId,
      );
      throw err;
    }
    const ok = status >= 200 && status < 300;
    const id: string | undefined = data?.id ?? existingId;
    if (!ok || !id) {
      const message = `HTTP ${status}: ${readableFhirError(data)}`;
      await this.saveLog(
        clinicId,
        logResourceType,
        localId,
        undefined,
        status,
        payload,
        data,
        message,
        existingId,
      );
      throw new StepError(message);
    }
    await this.saveLog(
      clinicId,
      logResourceType,
      localId,
      id,
      status,
      payload,
      data,
      undefined,
      existingId,
    );
    return id;
  }

  /** Kirim resource yang ID-nya disimpan di tabel link (tanpa kolom khusus). */
  private async sendLinked(
    clinicId: number,
    step: string,
    resourceType: string,
    localType: string,
    localId: number,
    body: Record<string, any>,
    logResourceType?: string,
  ): Promise<SyncStep> {
    const logType =
      logResourceType ??
      (localType === 'vital_sign'
        ? 'Observation'
        : `${resourceType}:${localType}`);
    const link = await this.linkRepo.findOne({
      where: { clinicId, localType, localId },
    });
    try {
      const id = await this.send(
        clinicId,
        resourceType,
        localId,
        body,
        link?.satusehatId,
        logType,
      );
      if (!link) {
        await this.linkRepo.save({
          clinicId,
          localType,
          localId,
          resourceType,
          satusehatId: id,
        });
      }
      return this.ok(step, resourceType, localType, localId, id);
    } catch (err) {
      return this.fail(
        step,
        resourceType,
        localType,
        localId,
        (err as Error).message,
      );
    }
  }

  private async findEncounterIdFor(
    resourceType: string,
    localId: number,
  ): Promise<number | undefined> {
    const repo: Record<
      string,
      Repository<{ id: number; encounterId: number }>
    > = {
      Condition: this.diagnosisRepo,
      Procedure: this.procedureRepo,
      Observation: this.vitalSignRepo,
      MedicationRequest: this.prescriptionRepo,
      MedicationDispense: this.dispenseRepo,
    } as never;
    const r = repo[resourceType];
    if (!r) return undefined;
    const row = await r.findOne({
      where: { id: localId },
      select: { id: true, encounterId: true } as never,
    });
    return row?.encounterId;
  }

  private isConfigured(clinic: Clinic | null): clinic is Clinic {
    return !!(
      clinic?.satusehatOrgId &&
      clinic.satusehatClientId &&
      clinic.satusehatClientSecret
    );
  }

  private ok(
    step: string,
    resourceType: string,
    localType: string,
    localId: number,
    satusehatId: string,
  ): SyncStep {
    return {
      step,
      resourceType,
      localType,
      localId,
      status: 'success',
      satusehatId,
    };
  }

  private fail(
    step: string,
    resourceType: string,
    localType: string,
    localId: number,
    message: string,
  ): SyncStep {
    return {
      step,
      resourceType,
      localType,
      localId,
      status: 'failed',
      message,
    };
  }

  private skip(
    step: string,
    resourceType: string,
    localType: string,
    localId: number,
    message: string,
  ): SyncStep {
    return {
      step,
      resourceType,
      localType,
      localId,
      status: 'skipped',
      message,
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
    existingId?: string,
  ): Promise<void> {
    try {
      await this.syncLogRepo.save({
        clinicId,
        resourceType,
        localId,
        satusehatId: satusehatId ?? existingId,
        operation: existingId ? SyncOperation.UPDATE : SyncOperation.CREATE,
        status: errorMessage ? SyncLogStatus.FAILED : SyncLogStatus.SUCCESS,
        httpStatus,
        requestPayload,
        responsePayload,
        errorMessage,
      });
    } catch (err) {
      this.logger.warn(`Gagal menyimpan log sync: ${(err as Error).message}`);
    }
  }
}
