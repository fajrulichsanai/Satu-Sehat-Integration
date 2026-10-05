import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository, type ObjectLiteral } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { Location } from '../../location/entities/location.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Practitioner } from '../../practitioners/entities/practitioner.entity';
import { SatusehatOrganization } from '../onboarding/entities/satusehat-organization.entity';
import { missingAddressFields } from '../onboarding/address';
import {
  SatusehatSyncLog,
  SyncLogStatus,
} from '../sync/entities/satusehat-sync-log.entity';
import {
  credentialSource,
  withEffectiveCredentials,
} from '../satusehat-credentials';
import { SatusehatMonitorService } from '../monitor/satusehat-monitor.service';

/** Hitungan total & terhubung per klinik (satu query per jenis data) */
type Counts = Map<number, { total: number; linked: number; failed: number }>;

const RECENT_DAYS = 30;

/**
 * Pantauan SATUSEHAT seluruh klinik untuk super admin: kesiapan onboarding,
 * data yang sudah terhubung, dan kesehatan pengiriman per klinik.
 */
@Injectable()
export class SatusehatAdminService {
  constructor(
    @InjectRepository(Clinic) private readonly clinicRepo: Repository<Clinic>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
    @InjectRepository(Patient)
    private readonly patientRepo: Repository<Patient>,
    @InjectRepository(Practitioner)
    private readonly practitionerRepo: Repository<Practitioner>,
    @InjectRepository(Location)
    private readonly locationRepo: Repository<Location>,
    @InjectRepository(SatusehatOrganization)
    private readonly orgRepo: Repository<SatusehatOrganization>,
    @InjectRepository(SatusehatSyncLog)
    private readonly syncLogRepo: Repository<SatusehatSyncLog>,
    private readonly monitor: SatusehatMonitorService,
  ) {}

  async overview() {
    const since = new Date(Date.now() - RECENT_DAYS * 86_400_000);
    const [
      clinics,
      orgs,
      locations,
      practitioners,
      patients,
      encounters,
      logs,
    ] = await Promise.all([
      this.clinicRepo.find({ order: { name: 'ASC' } }),
      this.counts(this.orgRepo, 'satusehatId'),
      this.counts(this.locationRepo, 'satusehatLocationId', 'x.isActive = 1'),
      this.counts(this.practitionerRepo, 'satusehatPractitionerId'),
      this.counts(this.patientRepo, 'satusehatPatientId'),
      this.counts(
        this.encounterRepo,
        'satusehatEncounterId',
        "x.status = 'finished'",
        true,
      ),
      this.syncLogRepo
        .createQueryBuilder('l')
        .select('l.clinicId', 'clinicId')
        .addSelect(`SUM(l.status = '${SyncLogStatus.SUCCESS}')`, 'success')
        .addSelect(`SUM(l.status = '${SyncLogStatus.FAILED}')`, 'failed')
        .addSelect('MAX(l.createdAt)', 'lastSyncAt')
        .where('l.createdAt >= :since', { since })
        .groupBy('l.clinicId')
        .getRawMany<{
          clinicId: number;
          success: string;
          failed: string;
          lastSyncAt: Date;
        }>(),
    ]);
    const logBy = new Map(logs.map((l) => [Number(l.clinicId), l]));
    const pick = (m: Counts, id: number) =>
      m.get(id) ?? { total: 0, linked: 0, failed: 0 };

    const rows = clinics.map((c) => {
      const source = credentialSource(c);
      const effective = withEffectiveCredentials(c);
      const profile = c.satusehatProfile;
      const log = logBy.get(c.id);
      const enc = pick(encounters, c.id);
      const row = {
        id: c.id,
        name: c.name,
        city: c.city ?? null,
        credential: {
          source,
          environment: source ? effective.satusehatEnvironment : null,
          organizationId: source ? effective.satusehatOrgId : null,
          verifiedName: c.satusehatOrgName ?? null,
          tokenValid:
            !!c.satusehatTokenExpiresAt &&
            c.satusehatTokenExpiresAt.getTime() > Date.now(),
        },
        profile: {
          facilityType: profile?.facilityType ?? null,
          complete:
            !!profile?.facilityType &&
            missingAddressFields(profile).length === 0,
        },
        organizations: pick(orgs, c.id),
        locations: pick(locations, c.id),
        practitioners: pick(practitioners, c.id),
        patients: pick(patients, c.id),
        encounters: enc,
        sync: {
          days: RECENT_DAYS,
          success: Number(log?.success ?? 0),
          failed: Number(log?.failed ?? 0),
          lastSyncAt: log?.lastSyncAt ?? null,
        },
      };
      return { ...row, health: health(row) };
    });

    return {
      totals: {
        clinics: rows.length,
        ready: rows.filter((r) => r.health === 'ok').length,
        attention: rows.filter((r) => r.health === 'warning').length,
        notSetUp: rows.filter((r) => r.health === 'setup').length,
      },
      clinics: rows,
    };
  }

  /** Detail satu klinik: ringkasan per resource + kegagalan terbaru */
  async clinicDetail(clinicId: number) {
    const clinic = await this.clinicRepo.findOne({ where: { id: clinicId } });
    if (!clinic) throw new NotFoundException('Klinik tidak ditemukan');
    const since = new Date(Date.now() - RECENT_DAYS * 86_400_000);
    const [summary, organizations, locations, recentFailures] =
      await Promise.all([
        this.monitor.getSummary(clinicId),
        this.orgRepo.find({ where: { clinicId }, order: { id: 'ASC' } }),
        this.locationRepo.find({ where: { clinicId }, order: { id: 'ASC' } }),
        this.syncLogRepo.find({
          where: {
            clinicId,
            status: SyncLogStatus.FAILED,
            createdAt: MoreThanOrEqual(since),
          },
          order: { id: 'DESC' },
          take: 20,
          select: {
            id: true,
            resourceType: true,
            localId: true,
            httpStatus: true,
            errorMessage: true,
            createdAt: true,
          },
        }),
      ]);
    return {
      clinic: { id: clinic.id, name: clinic.name, city: clinic.city ?? null },
      credentialSource: credentialSource(clinic),
      verifiedName: clinic.satusehatOrgName ?? null,
      profile: clinic.satusehatProfile ?? null,
      summary,
      organizations: organizations.map((o) => ({
        id: o.id,
        code: o.code,
        name: o.name,
        satusehatId: o.satusehatId,
        syncError: o.syncError,
      })),
      locations: locations.map((l) => ({
        id: l.id,
        name: l.name,
        active: l.isActive,
        satusehatId: l.satusehatLocationId ?? null,
        syncError: l.ssSyncError,
      })),
      recentFailures,
    };
  }

  private async counts<T extends ObjectLiteral>(
    repo: Repository<T>,
    idField: string,
    extraWhere?: string,
    withFailed = false,
  ): Promise<Counts> {
    const qb = repo
      .createQueryBuilder('x')
      .select('x.clinicId', 'clinicId')
      .addSelect('COUNT(*)', 'total')
      .addSelect(`SUM(x.${idField} IS NOT NULL)`, 'linked');
    if (withFailed) qb.addSelect("SUM(x.syncStatus = 'failed')", 'failed');
    if (extraWhere) qb.where(extraWhere);
    const raw = await qb
      .groupBy('x.clinicId')
      .getRawMany<{
        clinicId: number;
        total: string;
        linked: string;
        failed?: string;
      }>();
    return new Map(
      raw.map((r) => [
        Number(r.clinicId),
        {
          total: Number(r.total),
          linked: Number(r.linked ?? 0),
          failed: Number(r.failed ?? 0),
        },
      ]),
    );
  }
}

/** ok = siap & lancar, warning = ada kegagalan/data belum terhubung, setup = belum siap */
function health(r: {
  credential: { source: string | null; verifiedName: string | null };
  profile: { complete: boolean };
  locations: { linked: number };
  encounters: { failed: number };
  sync: { failed: number };
  practitioners: { total: number; linked: number };
}): 'ok' | 'warning' | 'setup' {
  if (!r.credential.source || !r.profile.complete || r.locations.linked === 0)
    return 'setup';
  if (
    r.encounters.failed > 0 ||
    r.sync.failed > 0 ||
    r.practitioners.linked < r.practitioners.total
  )
    return 'warning';
  return 'ok';
}
