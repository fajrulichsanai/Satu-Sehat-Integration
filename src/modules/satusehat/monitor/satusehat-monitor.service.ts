import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { SatusehatSyncLog } from '../sync/entities/satusehat-sync-log.entity';
import {
  ListResourcesQueryDto,
  ListSyncLogsQueryDto,
  MonitorStatus,
  SATUSEHAT_RESOURCE_TYPES,
  SatusehatResourceType,
} from './dto/monitor.dto';

/**
 * Definisi tiap resource yang dipantau. Semua resource dinormalisasi ke
 * kolom yang sama (title, subtitle, date, satusehatId, status, lastError)
 * supaya satu endpoint bisa melayani semua tab di menu SATUSEHAT.
 */
interface ResourceDef {
  label: string;
  /** Bisa dikirim ulang via POST /satusehat/sync/:resourceType/:localId */
  syncable: boolean;
  /** FROM + JOIN dengan alias `x` untuk tabel utama, sudah difilter clinicId */
  base: (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>;
  title: string;
  subtitle: string;
  date: string;
  satusehatId: string;
  /** Ekspresi SQL yang menghasilkan 'synced' | 'pending' | 'failed' */
  status: string;
  lastError: string;
  search: string[];
}

/** Status log terakhir untuk (resourceType, x.id) */
const lastLog = (type: string, col: 'status' | 'error_message') =>
  `(SELECT l.${col} FROM satusehat_sync_logs l WHERE l.resource_type = '${type}' AND l.local_id = x.id ORDER BY l.id DESC LIMIT 1)`;

/** Status untuk resource yang punya kolom satusehat_*_id + sync_status */
const idStatus = (idCol: string, type: string) =>
  `CASE WHEN ${idCol} IS NOT NULL AND ${idCol} <> '' THEN 'synced' ` +
  `WHEN x.sync_status = 'failed' OR ${lastLog(type, 'status')} = 'failed' THEN 'failed' ` +
  `ELSE 'pending' END`;

/** Status untuk resource yang hanya punya kolom id (tanpa sync_status) */
const idOrLogStatus = (idCol: string, type: string) =>
  `CASE WHEN ${idCol} IS NOT NULL AND ${idCol} <> '' THEN 'synced' ` +
  `WHEN ${lastLog(type, 'status')} = 'failed' THEN 'failed' ELSE 'pending' END`;

/** ID SATUSEHAT dari tabel satusehat_resource_links */
const linkId = (localType: string) =>
  `(SELECT k.satusehat_id FROM satusehat_resource_links k WHERE k.local_type = '${localType}' AND k.local_id = x.id LIMIT 1)`;

const linkStatus = (localType: string, logType: string) =>
  `CASE WHEN ${linkId(localType)} IS NOT NULL THEN 'synced' ` +
  `WHEN ${lastLog(logType, 'status')} = 'failed' THEN 'failed' ELSE 'pending' END`;

const encounterChild = (table: string) => (qb: SelectQueryBuilder<any>) =>
  qb
    .from(table, 'x')
    .innerJoin('encounters', 'e', 'e.id = x.encounter_id')
    .leftJoin('patients', 'pt', 'pt.id = e.patient_id')
    .where('e.clinic_id = :clinicId');

const RESOURCES: Record<SatusehatResourceType, ResourceDef> = {
  Patient: {
    label: 'Pasien',
    // "Kirim" = cari IHS pasien di SATUSEHAT berdasarkan NIK
    syncable: true,
    base: (qb) => qb.from('patients', 'x').where('x.clinic_id = :clinicId'),
    title: 'x.name',
    subtitle:
      "CONCAT('RM ', COALESCE(x.no_rm, '-'), ' · NIK ', COALESCE(x.nik, '-'))",
    date: 'x.created_at',
    satusehatId: 'COALESCE(x.satusehat_patient_id, x.ihs_number)',
    status:
      "CASE WHEN COALESCE(x.satusehat_patient_id, x.ihs_number) IS NOT NULL THEN 'synced' " +
      "WHEN x.sync_status = 'failed' THEN 'failed' ELSE 'pending' END",
    lastError: 'x.sync_error',
    search: ['x.name', 'x.no_rm', 'x.nik'],
  },
  Encounter: {
    label: 'Kunjungan (Encounter)',
    syncable: true,
    base: (qb) =>
      qb
        .from('encounters', 'x')
        .leftJoin('patients', 'pt', 'pt.id = x.patient_id')
        .where('x.clinic_id = :clinicId'),
    title: 'pt.name',
    subtitle: "CONCAT('Status kunjungan: ', x.status)",
    date: 'COALESCE(x.arrived_time, x.created_at)',
    satusehatId: 'x.satusehat_encounter_id',
    status: idStatus('x.satusehat_encounter_id', 'Encounter'),
    lastError: `COALESCE(x.sync_error, ${lastLog('Encounter', 'error_message')})`,
    search: ['pt.name', 'pt.no_rm'],
  },
  Condition: {
    label: 'Diagnosis (Condition)',
    syncable: true,
    base: encounterChild('diagnoses'),
    title: "CONCAT(x.icd10_code, ' — ', x.icd10_display)",
    subtitle: "CONCAT('Pasien: ', COALESCE(pt.name, '-'))",
    date: 'x.created_at',
    satusehatId: 'x.satusehat_condition_id',
    status: idStatus('x.satusehat_condition_id', 'Condition'),
    lastError: lastLog('Condition', 'error_message'),
    search: ['x.icd10_code', 'x.icd10_display', 'pt.name'],
  },
  Procedure: {
    label: 'Tindakan (Procedure)',
    syncable: true,
    base: encounterChild('procedures'),
    title: "CONCAT(x.icd9_code, ' — ', x.procedure_name)",
    subtitle: "CONCAT('Pasien: ', COALESCE(pt.name, '-'))",
    date: 'x.created_at',
    satusehatId: 'x.satusehat_procedure_id',
    status: idStatus('x.satusehat_procedure_id', 'Procedure'),
    lastError: lastLog('Procedure', 'error_message'),
    search: ['x.icd9_code', 'x.procedure_name', 'pt.name'],
  },
  Observation: {
    label: 'Tanda Vital (Observation)',
    syncable: true,
    base: encounterChild('vital_signs'),
    title: "CONCAT(x.name, ': ', x.value, ' ', COALESCE(x.unit, ''))",
    subtitle: "CONCAT('Pasien: ', COALESCE(pt.name, '-'))",
    date: 'COALESCE(x.recorded_at, x.created_at)',
    // vital_signs tidak punya kolom id SATUSEHAT → pakai tabel link
    satusehatId: linkId('vital_sign'),
    status: linkStatus('vital_sign', 'Observation'),
    lastError: lastLog('Observation', 'error_message'),
    search: ['x.name', 'pt.name'],
  },
  MedicationRequest: {
    label: 'Resep (MedicationRequest)',
    syncable: true,
    base: (qb) =>
      encounterChild('prescriptions')(qb).leftJoin(
        'medications',
        'm',
        'm.id = x.medication_id',
      ),
    title: "CONCAT(COALESCE(m.name, '-'), ' × ', x.quantity)",
    subtitle: "CONCAT('Pasien: ', COALESCE(pt.name, '-'))",
    date: 'x.created_at',
    satusehatId: 'x.satusehat_medreq_id',
    status: idStatus('x.satusehat_medreq_id', 'MedicationRequest'),
    lastError: lastLog('MedicationRequest', 'error_message'),
    search: ['m.name', 'pt.name'],
  },
  MedicationDispense: {
    label: 'Pengeluaran Obat (MedicationDispense)',
    syncable: true,
    base: (qb) =>
      encounterChild('dispenses')(qb).leftJoin(
        'medications',
        'm',
        'm.id = x.medication_id',
      ),
    title: "CONCAT(COALESCE(m.name, '-'), ' × ', x.quantity_dispensed)",
    subtitle: "CONCAT('Pasien: ', COALESCE(pt.name, '-'))",
    date: 'x.dispensed_at',
    satusehatId: linkId('dispense'),
    status: linkStatus('dispense', 'MedicationDispense'),
    lastError: lastLog('MedicationDispense', 'error_message'),
    search: ['m.name', 'pt.name'],
  },
  Practitioner: {
    label: 'Tenaga Kesehatan (Practitioner)',
    // "Kirim" = cari IHS nakes berdasarkan NIK
    syncable: true,
    base: (qb) =>
      qb.from('practitioners', 'x').where('x.clinic_id = :clinicId'),
    title: 'x.name',
    subtitle:
      "CONCAT('NIK ', COALESCE(x.nik, '-'), ' · ', COALESCE(x.specialization, '-'))",
    date: 'x.created_at',
    satusehatId: 'x.satusehat_practitioner_id',
    status: idOrLogStatus('x.satusehat_practitioner_id', 'Practitioner'),
    lastError: lastLog('Practitioner', 'error_message'),
    search: ['x.name', 'x.nik'],
  },
  Location: {
    label: 'Lokasi / Ruangan (Location)',
    // "Kirim" = buat resource Location di SATUSEHAT
    syncable: true,
    base: (qb) => qb.from('locations', 'x').where('x.clinic_id = :clinicId'),
    title: 'x.name',
    subtitle: "CONCAT('Tipe: ', x.type)",
    date: 'x.created_at',
    satusehatId: 'x.satusehat_location_id',
    status: idOrLogStatus('x.satusehat_location_id', 'Location'),
    lastError: lastLog('Location', 'error_message'),
    search: ['x.name'],
  },
};

export interface ResourceSummary {
  resourceType: SatusehatResourceType;
  label: string;
  syncable: boolean;
  total: number;
  synced: number;
  pending: number;
  failed: number;
}

@Injectable()
export class SatusehatMonitorService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Clinic)
    private readonly clinicRepo: Repository<Clinic>,
    @InjectRepository(SatusehatSyncLog)
    private readonly syncLogRepo: Repository<SatusehatSyncLog>,
  ) {}

  async getSummary(clinicId: number) {
    const clinic = await this.clinicRepo.findOne({ where: { id: clinicId } });
    if (!clinic) throw new NotFoundException('Klinik tidak ditemukan');

    const resources = await Promise.all(
      SATUSEHAT_RESOURCE_TYPES.map((type) =>
        this.countByStatus(type, clinicId),
      ),
    );

    const logCounts = await this.syncLogRepo
      .createQueryBuilder('l')
      .select('l.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('l.clinic_id = :clinicId', { clinicId })
      .groupBy('l.status')
      .getRawMany<{ status: string; count: string }>();

    const lastLog = await this.syncLogRepo.findOne({
      where: { clinicId },
      order: { id: 'DESC' },
      select: { id: true, createdAt: true, status: true, resourceType: true },
    });

    return {
      config: {
        configured: !!(
          clinic.satusehatOrgId &&
          clinic.satusehatClientId &&
          clinic.satusehatClientSecret
        ),
        environment: clinic.satusehatEnvironment,
        organizationId: clinic.satusehatOrgId ?? null,
        hasClientId: !!clinic.satusehatClientId,
        tokenValidUntil:
          clinic.satusehatTokenExpiresAt &&
          clinic.satusehatTokenExpiresAt.getTime() > Date.now()
            ? clinic.satusehatTokenExpiresAt
            : null,
      },
      resources,
      syncLogs: {
        success: Number(
          logCounts.find((c) => c.status === 'success')?.count ?? 0,
        ),
        failed: Number(
          logCounts.find((c) => c.status === 'failed')?.count ?? 0,
        ),
        pending: Number(
          logCounts.find((c) => c.status === 'pending')?.count ?? 0,
        ),
        lastSyncAt: lastLog?.createdAt ?? null,
      },
    };
  }

  async listResources(
    resourceType: SatusehatResourceType,
    clinicId: number,
    query: ListResourcesQueryDto,
  ) {
    const def = RESOURCES[resourceType];
    const { page, limit } = query;

    const qb = this.baseQuery(def, clinicId);
    if (query.status) {
      qb.andWhere(`(${def.status}) = :status`, { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        `(${def.search.map((c) => `${c} LIKE :search`).join(' OR ')})`,
        { search: `%${query.search}%` },
      );
    }

    const total = await qb.clone().select('COUNT(*)', 'count').getRawOne<{
      count: string;
    }>();

    const rows = await qb
      .select('x.id', 'localId')
      .addSelect(def.title, 'title')
      .addSelect(def.subtitle, 'subtitle')
      .addSelect(def.date, 'date')
      .addSelect(def.satusehatId, 'satusehatId')
      .addSelect(def.status, 'status')
      .addSelect(def.lastError, 'lastError')
      .orderBy('x.id', 'DESC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<{
        localId: number;
        title: string;
        subtitle: string;
        date: Date;
        satusehatId: string | null;
        status: MonitorStatus;
        lastError: string | null;
      }>();

    const totalCount = Number(total?.count ?? 0);
    return {
      resourceType,
      label: def.label,
      syncable: def.syncable,
      items: rows.map((r) => ({ ...r, localId: Number(r.localId) })),
      page,
      limit,
      total: totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
    };
  }

  async listSyncLogs(clinicId: number, query: ListSyncLogsQueryDto) {
    const { page, limit } = query;
    const qb = this.syncLogRepo
      .createQueryBuilder('l')
      .select([
        'l.id',
        'l.resourceType',
        'l.localId',
        'l.satusehatId',
        'l.operation',
        'l.status',
        'l.httpStatus',
        'l.errorMessage',
        'l.retryCount',
        'l.createdAt',
      ])
      .where('l.clinicId = :clinicId', { clinicId })
      .orderBy('l.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.resourceType) {
      qb.andWhere('l.resourceType = :resourceType', {
        resourceType: query.resourceType,
      });
    }
    if (query.status) {
      qb.andWhere('l.status = :status', { status: query.status });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async getSyncLog(clinicId: number, id: number) {
    const log = await this.syncLogRepo.findOne({ where: { id, clinicId } });
    if (!log) throw new NotFoundException('Log sync tidak ditemukan');
    return log;
  }

  private baseQuery(def: ResourceDef, clinicId: number) {
    return def
      .base(this.dataSource.createQueryBuilder())
      .setParameter('clinicId', clinicId);
  }

  private async countByStatus(
    resourceType: SatusehatResourceType,
    clinicId: number,
  ): Promise<ResourceSummary> {
    const def = RESOURCES[resourceType];
    const rows = await this.baseQuery(def, clinicId)
      // Alias unik: GROUP BY `status` akan bentrok dengan kolom status asli
      // (mis. encounters.status) karena MySQL memprioritaskan nama kolom.
      .select(def.status, 'monitor_status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('monitor_status')
      .getRawMany<{ monitor_status: MonitorStatus; count: string }>();

    const get = (s: MonitorStatus) =>
      Number(rows.find((r) => r.monitor_status === s)?.count ?? 0);
    const synced = get('synced');
    const pending = get('pending');
    const failed = get('failed');

    return {
      resourceType,
      label: def.label,
      syncable: def.syncable,
      total: synced + pending + failed,
      synced,
      pending,
      failed,
    };
  }
}
