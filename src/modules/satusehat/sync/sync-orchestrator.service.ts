import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Practitioner } from '../../practitioners/entities/practitioner.entity';
import { Location } from '../../location/entities/location.entity';
import { PhysicalExamination } from '../../physical-examination/entities/physical-examination.entity';
import { DentalExamination } from '../../dental-examination/entities/dental-examination.entity';
import {
  EncounterSoapNote,
  SoapDiagnosis,
} from '../../encounter-soap-notes/entities/encounter-soap-note.entity';
import { Billing, BillingStatus } from '../../billing/entities/billing.entity';
import { BillingItem } from '../../billing-item/entities/billing-item.entity';
import { PrescriptionItem } from '../../prescriptions/entities/prescription-item.entity';
import {
  SatusehatSyncLog,
  SyncLogStatus,
  SyncOperation,
  redactSyncError,
} from './entities/satusehat-sync-log.entity';
import { SatusehatResourceLink } from './entities/satusehat-resource-link.entity';
import { SyncStatus } from '../../../enums/sync-status.enum';
import { SatusehatClientService } from '../satusehat-client.service';
import { KfaProduct, KfaService } from '../kfa/kfa.service';
import { FhirContext, FhirMapper, LinkedResource } from '../fhir/fhir-mapper';
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

/** localType link untuk satu diagnosis SOAP (unik per kode di satu catatan) */
const diagnosisLinkType = (dx: SoapDiagnosis) =>
  `soap_dx:${dx.system}:${dx.code}`.slice(0, 50);

/**
 * Pengiriman data kunjungan rawat jalan gigi ke SATUSEHAT, mengikuti Playbook
 * "RME Rawat Jalan" / Postman "Use Case - Gigi":
 *
 *   01 Prasyarat  : Patient & Practitioner (cari by NIK), Location (buat bila belum)
 *   02 Encounter  : POST (arrived / in-progress)
 *   04 Pemeriksaan: Observation tanda vital (pemeriksaan fisik), OHIS
 *   07 Diagnosis  : Condition dari diagnosis SOAP (ICD-10 / SNOMED CT)
 *   08 Tindakan   : Procedure dari tagihan bertarif ICD-9-CM
 *   09 Obat       : Medication (KFA) + MedicationRequest dari resep
 *   12 Pulang     : PUT Encounter finished + diagnosis + dischargeDisposition
 *
 * Log sync tidak menyimpan payload FHIR (data sensitif) dan pesan error
 * disamarkan dengan redactSyncError.
 */
@Injectable()
export class SyncOrchestratorService {
  private readonly logger = new Logger(SyncOrchestratorService.name);

  constructor(
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Clinic) private readonly clinicRepo: Repository<Clinic>,
    @InjectRepository(Practitioner)
    private readonly practitionerRepo: Repository<Practitioner>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(PhysicalExamination)
    private readonly physicalRepo: Repository<PhysicalExamination>,
    @InjectRepository(DentalExamination)
    private readonly dentalRepo: Repository<DentalExamination>,
    @InjectRepository(EncounterSoapNote)
    private readonly soapRepo: Repository<EncounterSoapNote>,
    @InjectRepository(Billing)
    private readonly billingRepo: Repository<Billing>,
    @InjectRepository(BillingItem)
    private readonly billingItemRepo: Repository<BillingItem>,
    @InjectRepository(PrescriptionItem)
    private readonly prescriptionRepo: Repository<PrescriptionItem>,
    @InjectRepository(SatusehatSyncLog)
    private readonly syncLogRepo: Repository<SatusehatSyncLog>,
    @InjectRepository(SatusehatResourceLink)
    private readonly linkRepo: Repository<SatusehatResourceLink>,
    private readonly satusehatClient: SatusehatClientService,
    private readonly kfaService: KfaService,
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
          'Konfigurasi SATUSEHAT klinik belum lengkap',
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
      await this.markEncounterFailed(encounter.id, err);
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

    // 04. Pemeriksaan fisik — tanda vital
    const physical = await this.physicalRepo.findOne({
      where: { encounterId },
    });
    if (physical) {
      for (const r of FhirMapper.toVitalSignObservations(physical, ctx)) {
        steps.push(await this.sendLinked(clinicId, '04. Tanda Vital', r));
      }
    }

    // 04. Pemeriksaan gigi — OHIS
    const dental = await this.dentalRepo.findOne({ where: { encounterId } });
    if (dental) {
      for (const r of FhirMapper.toOhisObservations(dental, ctx)) {
        steps.push(await this.sendLinked(clinicId, '04. OHIS', r));
      }
    }

    // 07. Diagnosis (SOAP) — utama dulu
    const soap = await this.soapRepo.findOne({ where: { encounterId } });
    const diagnoses = [...(soap?.diagnoses ?? [])].sort(
      (a, b) => Number(b.primary) - Number(a.primary),
    );
    const conditionIds: { conditionId: string; display: string }[] = [];
    for (const dx of diagnoses) {
      const step = await this.sendLinked(clinicId, '07. Diagnosis', {
        localType: diagnosisLinkType(dx),
        localId: soap!.id,
        resource: FhirMapper.toCondition(
          dx,
          soap!.updatedAt ?? soap!.createdAt,
          ctx,
        ),
      });
      steps.push(step);
      if (step.status === 'success') {
        conditionIds.push({
          conditionId: step.satusehatId!,
          display: dx.nameId || dx.display,
        });
      }
    }
    const primaryDx = diagnoses.find((d) => d.primary) ?? diagnoses[0] ?? null;

    // 08. Tindakan — item tagihan bertarif ICD-9-CM
    for (const item of await this.procedureItems(encounterId)) {
      steps.push(
        await this.sendLinked(clinicId, '08. Tindakan', {
          localType: 'billing_item',
          localId: item.id,
          resource: FhirMapper.toProcedure(item, encounter, ctx, primaryDx),
        }),
      );
    }

    // 09. Peresepan obat (KFA)
    const prescriptions = await this.prescriptionRepo.find({
      where: { encounterId },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    for (const rx of prescriptions) {
      steps.push(
        ...(await this.syncPrescription(clinicId, rx, encounter, ctx)),
      );
    }

    // 12. Cara keluar — PUT Encounter finished dengan diagnosis
    if (encounter.status === 'finished' || encounter.status === 'cancelled') {
      try {
        const body = FhirMapper.toEncounter(encounter, ctx, conditionIds);
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
        await this.markEncounterFailed(encounter.id, err);
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
   * Kirim satu baris dari menu SATUSEHAT / antrean retry. Data klinis
   * (resep, tindakan) bergantung pada Encounter, jadi dikirim ulang lewat
   * kunjungannya.
   */
  async syncResource(
    resourceType: string,
    localId: number,
    clinicId: number,
  ): Promise<SyncResult> {
    const clinic = await this.clinicRepo.findOne({ where: { id: clinicId } });
    if (!clinic || !this.isConfigured(clinic)) {
      return {
        success: false,
        error: 'Konfigurasi SATUSEHAT klinik belum lengkap',
      };
    }

    try {
      switch (resourceType) {
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

      const encounterId = await this.findEncounterIdFor(resourceType, localId);
      if (!encounterId) {
        return {
          success: false,
          error: `Resource type '${resourceType}' #${localId} tidak dikenali`,
        };
      }
      const { success, steps } = await this.syncEncounterFull(
        encounterId,
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
          'Kunjungan tidak memiliki ruangan dan Location ID Poli klinik belum diisi di Konfigurasi SATUSEHAT',
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
      orgId: clinic.satusehatOrgId as string,
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
        throw new StepError(
          `NIK pasien ${patient.name} tidak ditemukan di SATUSEHAT`,
        );
      await this.patientRepo.update(patient.id, {
        satusehatPatientId: id,
        syncStatus: SyncStatus.SYNCED,
        syncError: null as unknown as string,
        lastSyncAt: new Date(),
      });
      await this.saveLog(clinicId, 'Patient', patient.id, {
        satusehatId: id,
        httpStatus: 200,
      });
      patient.satusehatPatientId = id;
      return id;
    } catch (err) {
      const message = (err as Error).message;
      await this.patientRepo.update(patient.id, {
        syncStatus: SyncStatus.FAILED,
        syncError: redactSyncError(message) as string,
        lastSyncAt: new Date(),
      });
      await this.saveLog(clinicId, 'Patient', patient.id, { error: message });
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
          `NIK ${practitioner.name} tidak ditemukan di SATUSEHAT`,
        );
      await this.practitionerRepo.update(practitioner.id, {
        satusehatPractitionerId: id,
      });
      await this.saveLog(clinicId, 'Practitioner', practitioner.id, {
        satusehatId: id,
        httpStatus: 200,
      });
      practitioner.satusehatPractitionerId = id;
      return id;
    } catch (err) {
      await this.saveLog(clinicId, 'Practitioner', practitioner.id, {
        error: (err as Error).message,
      });
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
    const body = FhirMapper.toLocation(
      location,
      clinic.satusehatOrgId as string,
    );
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

  private async procedureItems(encounterId: number) {
    const billings = await this.billingRepo.find({
      where: {
        encounterId,
        status: Not(In([BillingStatus.CANCELLED, BillingStatus.REFUNDED])),
      },
      select: { id: true },
    });
    if (!billings.length) return [];
    const items = await this.billingItemRepo.find({
      where: { billingId: In(billings.map((b) => b.id)) },
      relations: { tarif: true },
      order: { id: 'ASC' },
    });
    return items.filter(
      (i): i is BillingItem & { tarif: { kodeIcd9: string; name: string } } =>
        !!i.tarif?.kodeIcd9?.trim(),
    );
  }

  private async syncPrescription(
    clinicId: number,
    rx: PrescriptionItem,
    encounter: Encounter,
    ctx: FhirContext,
  ): Promise<SyncStep[]> {
    const step = '09. Peresepan Obat';
    if (!rx.kfaCode) {
      const message = `Obat "${rx.drugName}" belum dipilih dari KFA — pilih ulang obat di resep agar bisa dikirim`;
      await this.saveLog(clinicId, 'MedicationRequest', rx.id, {
        error: message,
      });
      return [this.fail(step, 'MedicationRequest', 'rx_item', rx.id, message)];
    }

    let kfa: KfaProduct;
    try {
      kfa = await this.kfaService.getProduct(rx.kfaCode);
    } catch {
      // Detail KFA opsional (bentuk sediaan/zat aktif); kode & nama tetap cukup
      kfa = {
        kfaCode: rx.kfaCode,
        name: rx.kfaName || rx.drugName,
        active: true,
        group: 'farmasi',
        dosageForm: null,
        route: null,
        uom: null,
        manufacturer: null,
        nie: null,
        generic: null,
        template: null,
        activeIngredients: [],
      };
    }

    const out: SyncStep[] = [];
    const med = await this.sendLinked(clinicId, step, {
      localType: 'rx_medication',
      localId: rx.id,
      resource: FhirMapper.toMedication(kfa, ctx, `RX-${rx.id}`),
    });
    out.push(med);
    if (med.status !== 'success') return out;
    out.push(
      await this.sendLinked(
        clinicId,
        step,
        {
          localType: 'rx_item',
          localId: rx.id,
          resource: FhirMapper.toMedicationRequest(
            rx,
            kfa,
            med.satusehatId!,
            encounter,
            ctx,
          ),
        },
        'MedicationRequest',
      ),
    );
    return out;
  }

  private async markEncounterFailed(encounterId: number, err: unknown) {
    await this.encounterRepo.update(encounterId, {
      syncStatus: SyncStatus.FAILED,
      syncError: redactSyncError((err as Error).message) as string,
      lastSyncAt: new Date(),
    });
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
    let status: number;
    let data: any;
    try {
      ({ status, data } = await this.satusehatClient.sendFhirResource(
        clinicId,
        existingId ? 'PUT' : 'POST',
        path,
        payload,
      ));
    } catch (err) {
      await this.saveLog(clinicId, logResourceType, localId, {
        error: (err as Error).message,
        existingId,
      });
      throw err;
    }
    const ok = status >= 200 && status < 300;
    const id: string | undefined = data?.id ?? existingId;
    if (!ok || !id) {
      const message = `HTTP ${status}: ${readableFhirError(data)}`;
      await this.saveLog(clinicId, logResourceType, localId, {
        httpStatus: status,
        error: message,
        existingId,
      });
      throw new StepError(message);
    }
    await this.saveLog(clinicId, logResourceType, localId, {
      satusehatId: id,
      httpStatus: status,
      existingId,
    });
    return id;
  }

  /** Kirim resource yang ID-nya disimpan di satusehat_resource_links. */
  private async sendLinked(
    clinicId: number,
    step: string,
    { localType, localId, resource }: LinkedResource,
    logResourceType?: string,
  ): Promise<SyncStep> {
    const resourceType: string = resource.resourceType;
    const logType =
      logResourceType ?? `${resourceType}:${localType}`.slice(0, 50);
    const link = await this.linkRepo.findOne({
      where: { clinicId, localType, localId },
    });
    try {
      const id = await this.send(
        clinicId,
        resourceType,
        localId,
        resource,
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
    switch (resourceType) {
      case 'Encounter':
        return localId;
      case 'MedicationRequest':
        return (
          await this.prescriptionRepo.findOne({
            where: { id: localId },
            select: { id: true, encounterId: true },
          })
        )?.encounterId;
      case 'Procedure': {
        const item = await this.billingItemRepo.findOne({
          where: { id: localId },
          relations: { billing: true },
        });
        return item?.billing?.encounterId;
      }
      default:
        return undefined;
    }
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
      message: redactSyncError(message),
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
    opts: {
      satusehatId?: string;
      httpStatus?: number;
      error?: string;
      existingId?: string;
    },
  ): Promise<void> {
    try {
      await this.syncLogRepo.save({
        clinicId,
        resourceType: resourceType.slice(0, 50),
        localId,
        satusehatId: opts.satusehatId ?? opts.existingId,
        operation: opts.existingId
          ? SyncOperation.UPDATE
          : SyncOperation.CREATE,
        status: opts.error ? SyncLogStatus.FAILED : SyncLogStatus.SUCCESS,
        httpStatus: opts.httpStatus,
        errorMessage: redactSyncError(opts.error),
      });
    } catch (err) {
      this.logger.warn(`Gagal menyimpan log sync: ${(err as Error).message}`);
    }
  }
}
