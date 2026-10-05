import {
  withEffectiveCredentials,
  credentialSource,
} from '../satusehat-credentials';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Location } from '../../location/entities/location.entity';
import { Practitioner } from '../../practitioners/entities/practitioner.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { SatusehatClientService } from '../satusehat-client.service';
import { SyncOrchestratorService } from '../sync/sync-orchestrator.service';
import { FhirMapper } from '../fhir/fhir-mapper';
import { readableFhirError } from '../fhir/fhir-error';
import { redactSyncError } from '../sync/entities/satusehat-sync-log.entity';
import { SatusehatOrganization } from './entities/satusehat-organization.entity';
import { SatusehatAddress, missingAddressFields } from './address';
import {
  FacilityProfileDto,
  SaveLocationDto,
  SaveOrganizationDto,
} from './dto/onboarding.dto';

/**
 * Onboarding SATUSEHAT untuk klinik pratama/utama, TPMD, dan TPMDG:
 *   1. Autentikasi (Kode Akses API dari env server / Konfigurasi klinik)
 *   2. Profil fasyankes + verifikasi Organization induk
 *   3. Organization (sub-organisasi) — Template Registrasi Organization & Location
 *   4. Location (site/gedung/ruang) — template yang sama
 *   5. Practitioner, 6. Patient — pencocokan NIK
 */

const PATIENT_BATCH = 50;

/** Struktur awal yang disarankan per jenis fasyankes (draf, bisa diubah). */
const TEMPLATES: Record<
  string,
  { code: string; name: string; type: string; parent?: string }[]
> = {
  klinik_pratama: [
    { code: 'YANKES', name: 'Pelayanan Kesehatan', type: 'dept' },
    { code: 'POLI-UMUM', name: 'Poli Umum', type: 'dept', parent: 'YANKES' },
    { code: 'POLI-GIGI', name: 'Poli Gigi', type: 'dept', parent: 'YANKES' },
    { code: 'FARMASI', name: 'Farmasi', type: 'dept', parent: 'YANKES' },
  ],
  klinik_utama: [
    { code: 'YANKES', name: 'Pelayanan Medik dan Penunjang', type: 'dept' },
    {
      code: 'POLI-SPESIALIS',
      name: 'Poli Spesialis',
      type: 'dept',
      parent: 'YANKES',
    },
    { code: 'POLI-UMUM', name: 'Poli Umum', type: 'dept', parent: 'YANKES' },
    { code: 'LAB', name: 'Laboratorium', type: 'dept', parent: 'YANKES' },
    { code: 'FARMASI', name: 'Farmasi', type: 'dept', parent: 'YANKES' },
  ],
  tpmd: [{ code: 'PRAKTIK', name: 'Praktik Mandiri Dokter', type: 'dept' }],
  tpmdg: [
    { code: 'PRAKTIK', name: 'Praktik Mandiri Dokter Gigi', type: 'dept' },
  ],
};

const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null);

function cleanAddress(a?: SatusehatAddress | null): SatusehatAddress | null {
  if (!a) return null;
  const out: SatusehatAddress = {};
  for (const [k, v] of Object.entries(a)) {
    const t = typeof v === 'string' ? v.trim() : v;
    if (t) (out as Record<string, unknown>)[k] = t;
  }
  return Object.keys(out).length ? out : null;
}

@Injectable()
export class SatusehatOnboardingService {
  constructor(
    @InjectRepository(Clinic) private readonly clinicRepo: Repository<Clinic>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(Practitioner)
    private readonly practitionerRepo: Repository<Practitioner>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(SatusehatOrganization)
    private readonly orgRepo: Repository<SatusehatOrganization>,
    private readonly client: SatusehatClientService,
    private readonly orchestrator: SyncOrchestratorService,
  ) {}

  // ── Status ────────────────────────────────────────────────────────────

  async status(clinicId: number) {
    const raw = await this.rawClinic(clinicId);
    const source = credentialSource(raw);
    const clinic = withEffectiveCredentials(raw);
    const [
      organizations,
      locations,
      practitioners,
      patientsTotal,
      patientsLinked,
    ] = await Promise.all([
      this.orgRepo.find({ where: { clinicId }, order: { id: 'ASC' } }),
      this.locationRepo.find({ where: { clinicId }, order: { id: 'ASC' } }),
      this.practitionerRepo.find({ where: { clinicId }, order: { id: 'ASC' } }),
      this.patientRepo.count({ where: { clinicId } }),
      this.patientRepo.count({
        where: { clinicId, satusehatPatientId: Not(IsNull()) },
      }),
    ]);
    return {
      auth: {
        source,
        environment: source ? clinic.satusehatEnvironment : null,
        organizationId: source ? clinic.satusehatOrgId : null,
        tokenValidUntil:
          raw.satusehatTokenExpiresAt &&
          raw.satusehatTokenExpiresAt.getTime() > Date.now()
            ? raw.satusehatTokenExpiresAt
            : null,
      },
      profile: {
        clinicName: raw.name,
        verifiedName: raw.satusehatOrgName,
        ...(raw.satusehatProfile ?? {}),
      },
      organizations,
      locations: locations.map((l) => ({
        id: l.id,
        name: l.name,
        active: l.isActive,
        code: l.ssCode,
        description: l.ssDescription,
        physicalType: l.ssPhysicalType ?? 'ro',
        parentLocationId: l.ssParentLocationId,
        organizationId: l.ssOrganizationId,
        phone: l.ssPhone,
        address: l.ssAddress,
        latitude:
          l.ssLatitude !== null && l.ssLatitude !== undefined
            ? Number(l.ssLatitude)
            : null,
        longitude:
          l.ssLongitude !== null && l.ssLongitude !== undefined
            ? Number(l.ssLongitude)
            : null,
        hours: l.ssHours,
        satusehatId: l.satusehatLocationId ?? null,
        syncError: l.ssSyncError,
      })),
      practitioners: practitioners.map((p) => ({
        id: p.id,
        name: p.name,
        satusehatId: p.satusehatPractitionerId ?? null,
        note: p.nik ? null : 'NIK belum diisi',
      })),
      patients: { total: patientsTotal, linked: patientsLinked },
    };
  }

  // ── 1. Autentikasi ────────────────────────────────────────────────────

  async testAuth(clinicId: number) {
    await this.configuredClinic(clinicId);
    const { expiresAt } = await this.client.testConnection(clinicId);
    return { connected: true, tokenExpiresAt: expiresAt };
  }

  // ── 2. Profil fasyankes & organisasi induk ────────────────────────────

  async saveProfile(clinicId: number, dto: FacilityProfileDto, userId: number) {
    const clinic = await this.rawClinic(clinicId);
    const { latitude, longitude, ...rest } = dto;
    clinic.satusehatProfile = {
      ...(cleanAddress(rest) ?? {}),
      facilityType: dto.facilityType,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
    };
    clinic.updatedBy = userId;
    await this.clinicRepo.save(clinic);
    return clinic.satusehatProfile;
  }

  /** Organization ID induk (dari Kode Akses API) harus ada & milik kredensial ini. */
  async verifyOrganization(clinicId: number) {
    const clinic = await this.configuredClinic(clinicId);
    const { status, data } = await this.client.getFhir(
      clinicId,
      `Organization/${encodeURIComponent(clinic.satusehatOrgId!)}`,
    );
    if (status >= 300 || data?.resourceType !== 'Organization') {
      throw new BadRequestException(
        `Organization ID ${clinic.satusehatOrgId} tidak ditemukan di SATUSEHAT ${clinic.satusehatEnvironment}: ${readableFhirError(data)}`,
      );
    }
    await this.clinicRepo.update(clinicId, {
      satusehatOrgName: data.name ?? null,
    });
    return {
      id: data.id as string,
      name: (data.name as string) ?? null,
      active: data.active !== false,
    };
  }

  // ── 3. Organization (sub-organisasi) ──────────────────────────────────

  async applyTemplate(clinicId: number, userId: number) {
    const clinic = await this.rawClinic(clinicId);
    const type = clinic.satusehatProfile?.facilityType;
    if (!type || !TEMPLATES[type])
      throw new BadRequestException(
        'Simpan profil fasyankes (jenis fasyankes) terlebih dahulu',
      );
    const existing = await this.orgRepo.find({ where: { clinicId } });
    const byCode = new Map(existing.map((o) => [o.code, o]));
    const p = clinic.satusehatProfile!;
    for (const t of TEMPLATES[type]) {
      if (byCode.has(t.code)) continue;
      const saved = await this.orgRepo.save(
        this.orgRepo.create({
          clinicId,
          code: t.code,
          name: t.name,
          type: t.type,
          parentId: t.parent ? (byCode.get(t.parent)?.id ?? null) : null,
          active: true,
          phone: p.phone ?? null,
          email: p.email ?? null,
          website: p.website ?? null,
          address: cleanAddress(p),
          createdBy: userId,
        }),
      );
      byCode.set(t.code, saved);
    }
    return this.orgRepo.find({ where: { clinicId }, order: { id: 'ASC' } });
  }

  async saveOrganization(
    clinicId: number,
    id: number | null,
    dto: SaveOrganizationDto,
    userId: number,
  ) {
    const org = id
      ? await this.findOrg(clinicId, id)
      : this.orgRepo.create({ clinicId, createdBy: userId });
    if (dto.parentId) {
      if (dto.parentId === id)
        throw new BadRequestException(
          'Organisasi tidak boleh menjadi induk dirinya sendiri',
        );
      await this.findOrg(clinicId, dto.parentId);
    }
    const dup = await this.orgRepo.findOne({
      where: { clinicId, code: dto.code.trim() },
    });
    if (dup && dup.id !== id)
      throw new BadRequestException(
        `Kode ${dto.code} sudah dipakai ${dup.name}`,
      );
    Object.assign(org, {
      parentId: dto.parentId ?? null,
      code: dto.code.trim(),
      name: dto.name.trim(),
      type: dto.type,
      active: dto.active ?? true,
      phone: clean(dto.phone),
      email: clean(dto.email),
      website: clean(dto.website),
      address: cleanAddress(dto.address),
      contactName: clean(dto.contactName),
      contactPhone: clean(dto.contactPhone),
      contactPurpose: dto.contactPurpose ?? null,
      updatedBy: userId,
    });
    return this.orgRepo.save(org);
  }

  async deleteOrganization(clinicId: number, id: number) {
    const org = await this.findOrg(clinicId, id);
    if (org.satusehatId)
      throw new BadRequestException(
        'Organisasi sudah terdaftar di SATUSEHAT — nonaktifkan saja (Aktif = tidak) lalu kirim ulang',
      );
    if (await this.orgRepo.exists({ where: { clinicId, parentId: id } }))
      throw new BadRequestException('Masih menjadi induk organisasi lain');
    await this.orgRepo.delete({ id });
  }

  /** POST (baru) / PUT (sudah terdaftar) satu Organization ke SATUSEHAT. */
  async sendOrganization(clinicId: number, id: number) {
    const clinic = await this.configuredClinic(clinicId);
    const org = await this.findOrg(clinicId, id);
    const missing = missingAddressFields(org.address);
    if (missing.length)
      throw new BadRequestException(
        `Lengkapi ${missing.join(', ')} untuk ${org.name}`,
      );
    let parentId = clinic.satusehatOrgId!;
    if (org.parentId) {
      const parent = await this.findOrg(clinicId, org.parentId);
      if (!parent.satusehatId)
        throw new BadRequestException(
          `Kirim organisasi induknya (${parent.name}) terlebih dahulu`,
        );
      parentId = parent.satusehatId;
    }
    try {
      const satusehatId = await this.orchestrator.sendPrerequisite(
        clinicId,
        'Organization',
        org.id,
        FhirMapper.toRegisteredOrganization(
          org,
          clinic.satusehatOrgId!,
          parentId,
        ),
        org.satusehatId,
      );
      await this.orgRepo.update(org.id, {
        satusehatId,
        syncError: null,
        lastSyncAt: new Date(),
      });
      return { ...org, satusehatId, syncError: null };
    } catch (err) {
      await this.orgRepo.update(org.id, {
        syncError: redactSyncError((err as Error).message) as string,
        lastSyncAt: new Date(),
      });
      throw new BadRequestException(
        `Gagal mengirim ${org.name}: ${(err as Error).message}`,
      );
    }
  }

  // ── 4. Location ───────────────────────────────────────────────────────

  async saveLocation(
    clinicId: number,
    id: number | null,
    dto: SaveLocationDto,
    userId: number,
  ) {
    const loc = id
      ? await this.findLocation(clinicId, id)
      : this.locationRepo.create({
          clinicId,
          type: 'ROOM',
          isActive: true,
          createdBy: userId,
        });
    if (dto.parentLocationId) {
      if (dto.parentLocationId === id)
        throw new BadRequestException(
          'Lokasi tidak boleh menjadi induk dirinya sendiri',
        );
      await this.findLocation(clinicId, dto.parentLocationId);
    }
    if (dto.organizationId) await this.findOrg(clinicId, dto.organizationId);
    Object.assign(loc, {
      name: dto.name.trim(),
      isActive: dto.active ?? loc.isActive ?? true,
      ssCode: clean(dto.code),
      ssDescription: clean(dto.description),
      ssPhysicalType: dto.physicalType,
      ssParentLocationId: dto.parentLocationId ?? null,
      ssOrganizationId: dto.organizationId ?? null,
      ssPhone: clean(dto.phone),
      ssAddress: cleanAddress(dto.address),
      ssLatitude: dto.latitude ?? null,
      ssLongitude: dto.longitude ?? null,
      ssHours: dto.hours?.days?.length ? dto.hours : null,
      updatedBy: userId,
    });
    const saved = await this.locationRepo.save(loc);
    return saved;
  }

  async sendLocation(clinicId: number, id: number) {
    const clinic = await this.configuredClinic(clinicId);
    const loc = await this.findLocation(clinicId, id);
    const missing = missingAddressFields(
      loc.ssAddress ?? clinic.satusehatProfile,
    );
    if (missing.length) {
      throw new BadRequestException(
        `Lengkapi ${missing.join(', ')} untuk ${loc.name} (atau di profil fasyankes)`,
      );
    }
    try {
      const satusehatId = await this.orchestrator.registerLocation(clinic, loc);
      return { id: loc.id, satusehatId };
    } catch (err) {
      await this.locationRepo.update(loc.id, {
        ssSyncError: redactSyncError((err as Error).message) as string,
      });
      throw new BadRequestException(
        `Gagal mengirim ${loc.name}: ${(err as Error).message}`,
      );
    }
  }

  // ── 5–6. Practitioner & Patient ───────────────────────────────────────

  async matchPractitioners(clinicId: number) {
    await this.configuredClinic(clinicId);
    const list = await this.practitionerRepo.find({
      where: { clinicId },
      order: { id: 'ASC' },
    });
    return this.each(
      list,
      (p) => this.orchestrator.practitionerIhsId(clinicId, p),
      (p) => p.name,
    );
  }

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

  // ── Bantuan ───────────────────────────────────────────────────────────

  private async each<T extends { id: number }>(
    items: T[],
    fn: (item: T) => Promise<string>,
    label: (item: T) => string,
  ) {
    const results: {
      id: number;
      name: string;
      satusehatId: string | null;
      error: string | null;
    }[] = [];
    for (const item of items) {
      try {
        results.push({
          id: item.id,
          name: label(item),
          satusehatId: await fn(item),
          error: null,
        });
      } catch (err) {
        results.push({
          id: item.id,
          name: label(item),
          satusehatId: null,
          error: (err as Error).message,
        });
      }
    }
    return {
      processed: results.length,
      succeeded: results.filter((r) => r.satusehatId).length,
      results,
    };
  }

  private async findOrg(clinicId: number, id: number) {
    const org = await this.orgRepo.findOne({ where: { id, clinicId } });
    if (!org) throw new NotFoundException('Organisasi tidak ditemukan');
    return org;
  }

  private async findLocation(clinicId: number, id: number) {
    const loc = await this.locationRepo.findOne({ where: { id, clinicId } });
    if (!loc) throw new NotFoundException('Lokasi tidak ditemukan');
    return loc;
  }

  private async rawClinic(clinicId: number) {
    const clinic = await this.clinicRepo.findOne({ where: { id: clinicId } });
    if (!clinic) throw new NotFoundException('Klinik tidak ditemukan');
    return clinic;
  }

  private async configuredClinic(clinicId: number) {
    const clinic = withEffectiveCredentials(await this.rawClinic(clinicId));
    if (
      !clinic.satusehatOrgId ||
      !clinic.satusehatClientId ||
      !clinic.satusehatClientSecret
    ) {
      throw new BadRequestException(
        'Kredensial SATUSEHAT belum diatur — isi SATUSEHAT_ORGANIZATION_ID, SATUSEHAT_CLIENT_ID, SATUSEHAT_CLIENT_SECRET di env server',
      );
    }
    return clinic;
  }
}
