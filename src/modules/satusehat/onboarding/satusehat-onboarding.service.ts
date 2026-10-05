import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Location } from '../../location/entities/location.entity';
import { Practitioner } from '../../practitioners/entities/practitioner.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { SatusehatClientService } from '../satusehat-client.service';
import { SyncOrchestratorService } from '../sync/sync-orchestrator.service';
import { toTeamOrganization } from '../fhir/fhir-mapper';
import { readableFhirError } from '../fhir/fhir-error';

/**
 * Persiapan sebelum interoperabilitas, mengikuti urutan katalog ReST API
 * SATUSEHAT: Autentikasi → Prerequisites (Organization, Location,
 * Practitioner, Patient). Struktur organisasi mengikuti Postman resmi
 * "00. Membuat Struktur Organisasi dan Lokasi":
 *   Organization induk (klinik)
 *     └ Pelayanan Kesehatan (team)        ← sub-organisasi
 *         ├ Poli Rawat Jalan (team)      ← managingOrganization ruangan
 *         └ Apotek (team)
 */

export interface OnboardingItem {
  id: number;
  name: string;
  satusehatId: string | null;
  note?: string | null;
}

const PATIENT_BATCH = 50;

@Injectable()
export class SatusehatOnboardingService {
  constructor(
    @InjectRepository(Clinic) private readonly clinicRepo: Repository<Clinic>,
    @InjectRepository(Location) private readonly locationRepo: Repository<Location>,
    @InjectRepository(Practitioner) private readonly practitionerRepo: Repository<Practitioner>,
    @InjectRepository(Patient) private readonly patientRepo: Repository<Patient>,
    private readonly client: SatusehatClientService,
    private readonly orchestrator: SyncOrchestratorService,
  ) {}

  async status(clinicId: number) {
    const clinic = await this.clinic(clinicId);
    const configured = !!(clinic.satusehatOrgId && clinic.satusehatClientId && clinic.satusehatClientSecret);
    const [locations, practitioners, patientsTotal, patientsLinked] = await Promise.all([
      this.locationRepo.find({ where: { clinicId }, order: { id: 'ASC' } }),
      this.practitionerRepo.find({ where: { clinicId }, order: { id: 'ASC' } }),
      this.patientRepo.count({ where: { clinicId } }),
      this.patientRepo.count({ where: { clinicId, satusehatPatientId: Not(IsNull()) } }),
    ]);
    return {
      auth: {
        configured,
        environment: clinic.satusehatEnvironment,
        tokenValidUntil:
          clinic.satusehatTokenExpiresAt && clinic.satusehatTokenExpiresAt.getTime() > Date.now()
            ? clinic.satusehatTokenExpiresAt
            : null,
      },
      organization: {
        id: clinic.satusehatOrgId,
        name: clinic.satusehatOrgName,
        suborgId: clinic.satusehatSuborgId,
        poliOrgId: clinic.satusehatPoliOrgId,
        pharmacyOrgId: clinic.satusehatPharmacyOrgId,
      },
      locations: locations.map<OnboardingItem>((l) => ({
        id: l.id,
        name: l.name,
        satusehatId: l.satusehatLocationId ?? null,
        note: l.isActive === false ? 'Nonaktif' : null,
      })),
      practitioners: practitioners.map<OnboardingItem>((p) => ({
        id: p.id,
        name: p.name,
        satusehatId: p.satusehatPractitionerId ?? null,
        note: p.nik ? null : 'NIK belum diisi',
      })),
      patients: { total: patientsTotal, linked: patientsLinked },
    };
  }

  /** Langkah 1 — minta token baru. */
  async testAuth(clinicId: number) {
    const { expiresAt } = await this.client.testConnection(clinicId);
    return { connected: true, tokenExpiresAt: expiresAt };
  }

  /** Langkah 2a — pastikan Organization ID induk benar & milik kredensial ini. */
  async verifyOrganization(clinicId: number) {
    const clinic = await this.configuredClinic(clinicId);
    const { status, data } = await this.client.getFhir(clinicId, `Organization/${encodeURIComponent(clinic.satusehatOrgId!)}`);
    if (status >= 300 || data?.resourceType !== 'Organization') {
      throw new BadRequestException(
        `Organization ID ${clinic.satusehatOrgId} tidak ditemukan di SATUSEHAT ${clinic.satusehatEnvironment}: ${readableFhirError(data)}`,
      );
    }
    await this.clinicRepo.update(clinicId, { satusehatOrgName: data.name ?? null });
    return { id: data.id as string, name: (data.name as string) ?? null, active: data.active !== false };
  }

  /** Langkah 2b — buat (atau perbarui) sub-organisasi, Poli, dan Apotek. */
  async buildOrganizationStructure(clinicId: number) {
    const clinic = await this.configuredClinic(clinicId);
    if (!clinic.satusehatOrgName) await this.verifyOrganization(clinicId);
    const orgId = clinic.satusehatOrgId!;
    const send = (code: string, name: string, parentId: string, existing: string | null) =>
      this.orchestrator.sendPrerequisite(
        clinicId,
        'Organization',
        clinicId,
        toTeamOrganization(clinic, orgId, code, name, parentId),
        existing,
      );
    const suborgId = await send('APX-UKP', 'Pelayanan Kesehatan', orgId, clinic.satusehatSuborgId);
    const poliOrgId = await send('APX-UKP-POLI', 'Poli Rawat Jalan', suborgId, clinic.satusehatPoliOrgId);
    const pharmacyOrgId = await send('APX-UKP-FAR', 'Apotek', suborgId, clinic.satusehatPharmacyOrgId);
    await this.clinicRepo.update(clinicId, {
      satusehatSuborgId: suborgId,
      satusehatPoliOrgId: poliOrgId,
      satusehatPharmacyOrgId: pharmacyOrgId,
    });
    return { suborgId, poliOrgId, pharmacyOrgId };
  }

  /** Langkah 3 — daftarkan semua ruangan aktif sebagai Location. */
  async registerLocations(clinicId: number) {
    const clinic = await this.configuredClinic(clinicId);
    if (!clinic.satusehatPoliOrgId) {
      throw new BadRequestException('Buat struktur Organization (langkah 2) terlebih dahulu');
    }
    const locations = await this.locationRepo.find({ where: { clinicId, isActive: true }, order: { id: 'ASC' } });
    if (!locations.length) {
      throw new BadRequestException('Belum ada ruangan aktif — tambahkan ruangan di Pengaturan → Lokasi');
    }
    return this.each(locations, (l) => this.orchestrator.registerLocation(clinic, l), (l) => l.name);
  }

  /** Langkah 4 — cari IHS semua tenaga kesehatan berdasarkan NIK. */
  async matchPractitioners(clinicId: number) {
    await this.configuredClinic(clinicId);
    const list = await this.practitionerRepo.find({ where: { clinicId }, order: { id: 'ASC' } });
    return this.each(list, (p) => this.orchestrator.practitionerIhsId(clinicId, p), (p) => p.name);
  }

  /** Langkah 5 — cari IHS pasien (bertahap, 50 per klik) berdasarkan NIK. */
  async matchPatients(clinicId: number) {
    await this.configuredClinic(clinicId);
    const list = await this.patientRepo.find({
      where: { clinicId, satusehatPatientId: IsNull() },
      order: { id: 'DESC' },
      take: PATIENT_BATCH,
    });
    const result = await this.each(
      list.filter((p) => !!p.nik),
      (p) => this.orchestrator.patientIhsId(clinicId, p),
      (p) => p.name,
    );
    return { ...result, skippedWithoutNik: list.filter((p) => !p.nik).length };
  }

  private async each<T extends { id: number }>(
    items: T[],
    fn: (item: T) => Promise<string>,
    label: (item: T) => string,
  ) {
    const results: { id: number; name: string; satusehatId: string | null; error: string | null }[] = [];
    for (const item of items) {
      try {
        results.push({ id: item.id, name: label(item), satusehatId: await fn(item), error: null });
      } catch (err) {
        results.push({ id: item.id, name: label(item), satusehatId: null, error: (err as Error).message });
      }
    }
    return {
      processed: results.length,
      succeeded: results.filter((r) => r.satusehatId).length,
      results,
    };
  }

  private async clinic(clinicId: number) {
    const clinic = await this.clinicRepo.findOne({ where: { id: clinicId } });
    if (!clinic) throw new BadRequestException('Klinik tidak ditemukan');
    return clinic;
  }

  private async configuredClinic(clinicId: number) {
    const clinic = await this.clinic(clinicId);
    if (!clinic.satusehatOrgId || !clinic.satusehatClientId || !clinic.satusehatClientSecret) {
      throw new BadRequestException(
        'Isi dan simpan Konfigurasi SATUSEHAT (Organization ID, Client ID, Client Secret) terlebih dahulu',
      );
    }
    return clinic;
  }
}
