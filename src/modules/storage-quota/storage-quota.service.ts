import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { StorageKind, StorageUsage } from './storage-usage.entity';
import {
  DEFAULT_STORAGE_GB,
  FALLBACK_STORAGE_GB,
  GB,
} from './storage-quota.constants';
import { STORAGE_GB_PER_BRANCH } from '../multi-clinic/multi-clinic.constants';

export interface StorageQuota {
  usedBytes: number;
  limitBytes: number;
  /** clinic = jatah klinik sendiri; multiklinik = dipakai bersama semua cabang. */
  scope: 'clinic' | 'multiklinik';
  /** Pemakaian klinik ini saja (sama dengan usedBytes bila scope = clinic). */
  clinicUsedBytes: number;
  activeBranches?: number;
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function formatBytes(bytes: number): string {
  if (bytes >= GB)
    return `${(bytes / GB).toLocaleString('id-ID', { maximumFractionDigits: 2 })} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
}

/**
 * Pencatatan dan jatah storage per klinik (PRD Super Admin: catat
 * penggunaan storage per klinik dan multiklinik; PRD Multi-Klinik MK-07:
 * jatah bersama). Every service upload is recorded with its size; an upload
 * that would go over the clinic's (or the multiklinik pool's) limit is
 * refused before the file is kept.
 */
@Injectable()
export class StorageQuotaService {
  private readonly logger = new Logger(StorageQuotaService.name);

  constructor(
    @InjectRepository(StorageUsage)
    private readonly usageRepository: Repository<StorageUsage>,
    private readonly dataSource: DataSource,
  ) {}

  /** Records (or updates) one stored file. Never throws: metering must not break an upload. */
  async record(
    clinicId: number,
    kind: StorageKind,
    ref: string,
    bytes: number,
  ): Promise<void> {
    try {
      await this.usageRepository.upsert(
        { clinicId, kind, ref, bytes: Math.max(0, Math.round(bytes)) },
        ['kind', 'ref'],
      );
    } catch (error) {
      this.logger.warn(
        `Gagal mencatat storage ${kind} ${ref}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async forget(kind: StorageKind, ref: string): Promise<void> {
    try {
      await this.usageRepository.delete({ kind, ref });
    } catch (error) {
      this.logger.warn(
        `Gagal menghapus catatan storage ${kind} ${ref}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Jatah dan pemakaian untuk klinik ini — bersama bila ia cabang multiklinik. */
  async quotaForClinic(clinicId: number): Promise<StorageQuota> {
    const [link] = await this.dataSource.query(
      `SELECT owner_id AS ownerId FROM owner_clinic_links
        WHERE clinic_id = ? AND status = 'approved' AND billing_mode <> 'stopped' LIMIT 1`,
      [clinicId],
    );
    const clinicUsedBytes = await this.usedByClinic(clinicId);
    if (link) {
      const pool = await this.quotaForOwner(Number(link.ownerId));
      return { ...pool, clinicUsedBytes };
    }
    return {
      usedBytes: clinicUsedBytes,
      limitBytes: (await this.planStorageGb(clinicId)) * GB,
      scope: 'clinic',
      clinicUsedBytes,
    };
  }

  /** Jatah bersama owner multiklinik: 5 GB × cabang aktif, dipakai semua cabang. */
  async quotaForOwner(ownerId: number): Promise<StorageQuota> {
    const [row] = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*) FROM owner_clinic_links
           WHERE owner_id = ? AND status = 'approved' AND billing_mode <> 'stopped') AS branches,
         (SELECT COALESCE(SUM(s.bytes), 0) FROM storage_usage s
            JOIN owner_clinic_links l ON l.clinic_id = s.clinic_id
           WHERE l.owner_id = ? AND l.status = 'approved' AND l.billing_mode <> 'stopped') AS used`,
      [ownerId, ownerId],
    );
    const activeBranches = toNumber(row?.branches);
    const usedBytes = toNumber(row?.used);
    return {
      usedBytes,
      limitBytes: activeBranches * STORAGE_GB_PER_BRANCH * GB,
      scope: 'multiklinik',
      clinicUsedBytes: usedBytes,
      activeBranches,
    };
  }

  /**
   * Refuses an upload of `incomingBytes` that would exceed the quota. Call
   * before keeping the file.
   */
  async assertRoom(clinicId: number, incomingBytes: number): Promise<void> {
    const quota = await this.quotaForClinic(clinicId);
    if (quota.usedBytes + Math.max(0, incomingBytes) <= quota.limitBytes)
      return;
    throw new ForbiddenException({
      success: false,
      error: {
        code: 'STORAGE_QUOTA_EXCEEDED',
        message:
          quota.scope === 'multiklinik'
            ? `Penyimpanan bersama multiklinik penuh (${formatBytes(quota.usedBytes)} dari ${formatBytes(quota.limitBytes)}). Hubungi owner multiklinik untuk menambah storage.`
            : `Penyimpanan klinik penuh (${formatBytes(quota.usedBytes)} dari ${formatBytes(quota.limitBytes)}). Tambah storage atau upgrade paket di menu Langganan.`,
      },
    });
  }

  /** Super Admin: pemakaian storage tiap klinik. */
  async listClinics() {
    const rows: { id: number; name: string; used: string | number }[] =
      await this.dataSource.query(
        `SELECT c.id, c.name, COALESCE(SUM(s.bytes), 0) AS used
         FROM clinics c
         LEFT JOIN storage_usage s ON s.clinic_id = c.id
        GROUP BY c.id, c.name
        ORDER BY used DESC, c.name ASC`,
      );
    return Promise.all(
      rows.map(async (r) => {
        const quota = await this.quotaForClinic(Number(r.id));
        return {
          clinicId: Number(r.id),
          clinicName: r.name,
          usedBytes: toNumber(r.used),
          limitBytes: quota.limitBytes,
          scope: quota.scope,
          poolUsedBytes: quota.usedBytes,
        };
      }),
    );
  }

  private async usedByClinic(clinicId: number): Promise<number> {
    const [row] = await this.dataSource.query(
      'SELECT COALESCE(SUM(bytes), 0) AS used FROM storage_usage WHERE clinic_id = ?',
      [clinicId],
    );
    return toNumber(row?.used);
  }

  /** storage_gb paket langganan terakhir klinik, atau bawaan tier-nya. */
  private async planStorageGb(clinicId: number): Promise<number> {
    const [row] = await this.dataSource.query(
      `SELECT p.tier, p.storage_gb AS storageGb
         FROM clinic_subscriptions cs
         JOIN subscription_plans p ON p.id = cs.plan_id
        WHERE cs.clinic_id = ?
        ORDER BY cs.id DESC LIMIT 1`,
      [clinicId],
    );
    if (row?.storageGb !== null && row?.storageGb !== undefined)
      return toNumber(row.storageGb);
    return DEFAULT_STORAGE_GB[row?.tier as string] ?? FALLBACK_STORAGE_GB;
  }
}
