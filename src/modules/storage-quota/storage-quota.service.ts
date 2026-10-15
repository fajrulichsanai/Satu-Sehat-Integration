import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { StorageKind, StorageUsage } from './storage-usage.entity';
import { StorageAddon, StorageAddonSource } from './storage-addon.entity';
import { GB, MAX_ADDON_GB_PER_PURCHASE } from './storage-quota.constants';
import { STORAGE_GB_PER_BRANCH } from '../multi-clinic/multi-clinic.constants';
import {
  planLimitsForClinic,
  STORAGE_ADDON_PRICE_PER_GB,
} from '../subscriptions/limits/plan-limits';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AuditActionType,
  AuditStatus,
} from '../audit-log/entities/audit-log.entity';
import { UserRole } from '../../enums';

export interface StorageQuota {
  usedBytes: number;
  limitBytes: number;
  /** clinic = jatah klinik sendiri; multiklinik = dipakai bersama semua cabang. */
  scope: 'clinic' | 'multiklinik';
  /** Pemakaian klinik ini saja (sama dengan usedBytes bila scope = clinic). */
  clinicUsedBytes: number;
  activeBranches?: number;
  /** Jatah dari paket (GB). */
  includedGb: number;
  /** Storage tambahan yang berlaku (GB). */
  extraGb: number;
  /** Harga storage tambahan per GB per bulan. */
  pricePerGb: number;
  /** Bagian storage tambahan yang ditagih saat ini (di luar bonus yang masih gratis). */
  billableExtraGb: number;
  /** Bonus dari Super Admin yang masih dalam masa gratis. */
  bonuses: StorageBonus[];
}

export interface StorageBonus {
  id: number;
  gb: number;
  /** Akhir masa gratis (inklusif); null = gratis selamanya. */
  freeUntil: string | null;
}

/** YYYY-MM-DD in server-local time (same convention as subscriptions). */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Last free day of a bonus that is free for `months` months starting `from`. */
export function freeUntilAfterMonths(
  months: number,
  from: Date = new Date(),
): string {
  const end = new Date(
    from.getFullYear(),
    from.getMonth() + months,
    from.getDate(),
  );
  end.setDate(end.getDate() - 1);
  return localDate(end);
}

/** Who asks for a change — the JWT user (see JwtStrategy). */
export interface StorageActor {
  userId: number;
  name?: string;
  role: string;
  clinicId?: number | null;
  actorRole?: string;
  branchMode?: boolean;
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
 * Pencatatan dan jatah storage (PRD Super Admin BL-03..06; PRD Multi-Klinik
 * MK-07). Every service upload is recorded with its size; an upload that
 * would go over the limit is refused before the file is kept.
 *
 * Batas klinik biasa = storage paket + storage tambahan klinik.
 * Batas cabang multiklinik = 5 GB × cabang aktif + storage tambahan owner,
 * dipakai bersama semua cabang.
 */
@Injectable()
export class StorageQuotaService {
  private readonly logger = new Logger(StorageQuotaService.name);

  constructor(
    @InjectRepository(StorageUsage)
    private readonly usageRepository: Repository<StorageUsage>,
    private readonly dataSource: DataSource,
    @Optional()
    @InjectRepository(StorageAddon)
    private readonly addonRepository?: Repository<StorageAddon>,
    @Optional() private readonly auditLog?: AuditLogService,
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

  /** The multiklinik owner whose shared pool this clinic uses, if any. */
  private async poolOwnerOf(clinicId: number): Promise<number | null> {
    const [link] = await this.dataSource.query(
      `SELECT owner_id AS ownerId FROM owner_clinic_links
        WHERE clinic_id = ? AND status = 'approved' AND billing_mode <> 'stopped' LIMIT 1`,
      [clinicId],
    );
    return link ? Number(link.ownerId) : null;
  }

  /** Jatah dan pemakaian untuk klinik ini — bersama bila ia cabang multiklinik. */
  async quotaForClinic(clinicId: number): Promise<StorageQuota> {
    const ownerId = await this.poolOwnerOf(clinicId);
    const clinicUsedBytes = await this.usedByClinic(clinicId);
    if (ownerId !== null) {
      const pool = await this.quotaForOwner(ownerId);
      return { ...pool, clinicUsedBytes };
    }
    const [plan, addons] = await Promise.all([
      planLimitsForClinic(this.dataSource, clinicId),
      this.addonSummary({ clinicId }),
    ]);
    return {
      usedBytes: clinicUsedBytes,
      limitBytes: Math.round((plan.storageGb + addons.extraGb) * GB),
      scope: 'clinic',
      clinicUsedBytes,
      includedGb: plan.storageGb,
      ...addons,
      pricePerGb: STORAGE_ADDON_PRICE_PER_GB,
    };
  }

  /** Jatah bersama owner multiklinik: 5 GB × cabang aktif + tambahan, dipakai semua cabang. */
  async quotaForOwner(ownerId: number): Promise<StorageQuota> {
    const [[row], addons] = await Promise.all([
      this.dataSource.query(
        `SELECT
           (SELECT COUNT(*) FROM owner_clinic_links
             WHERE owner_id = ? AND status = 'approved' AND billing_mode <> 'stopped') AS branches,
           (SELECT COALESCE(SUM(s.bytes), 0) FROM storage_usage s
              JOIN owner_clinic_links l ON l.clinic_id = s.clinic_id
             WHERE l.owner_id = ? AND l.status = 'approved' AND l.billing_mode <> 'stopped') AS used`,
        [ownerId, ownerId],
      ),
      this.addonSummary({ ownerId }),
    ]);
    const activeBranches = toNumber(row?.branches);
    const usedBytes = toNumber(row?.used);
    const includedGb = activeBranches * STORAGE_GB_PER_BRANCH;
    return {
      usedBytes,
      limitBytes: (includedGb + addons.extraGb) * GB,
      scope: 'multiklinik',
      clinicUsedBytes: usedBytes,
      activeBranches,
      includedGb,
      ...addons,
      pricePerGb: STORAGE_ADDON_PRICE_PER_GB,
    };
  }

  /**
   * Refuses an upload of `incomingBytes` that would exceed the quota. Call
   * before keeping the file. Text records are never affected.
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
            ? `Penyimpanan bersama multiklinik penuh (${formatBytes(quota.usedBytes)} dari ${formatBytes(quota.limitBytes)}). Owner multiklinik bisa menambah storage dari halaman Langganan.`
            : `Penyimpanan klinik penuh (${formatBytes(quota.usedBytes)} dari ${formatBytes(quota.limitBytes)}). Tambah storage di menu Langganan (Rp${STORAGE_ADDON_PRICE_PER_GB.toLocaleString('id-ID')} per GB).`,
      },
    });
  }

  // ─── Storage tambahan (BL-05) ──────────────────────────────────────────

  /** Storage tambahan yang berlaku (GB) untuk satu klinik atau satu owner multiklinik. */
  async extraGb(scope: {
    clinicId?: number;
    ownerId?: number;
  }): Promise<number> {
    return (await this.addonSummary(scope)).extraGb;
  }

  private scopeSql(scope: { clinicId?: number; ownerId?: number }) {
    return scope.ownerId
      ? { where: 'owner_id = ?', param: scope.ownerId }
      : { where: 'clinic_id = ?', param: scope.clinicId };
  }

  /**
   * Total tambahan, bagian yang ditagih, dan bonus yang masih gratis. A
   * bonus whose free period has ended stays (still counts to the limit)
   * and is billed from then on.
   */
  async addonSummary(
    scope: { clinicId?: number; ownerId?: number },
    today: string = localDate(),
  ): Promise<{
    extraGb: number;
    billableExtraGb: number;
    bonuses: StorageBonus[];
  }> {
    if (!this.addonRepository)
      return { extraGb: 0, billableExtraGb: 0, bonuses: [] };
    const { where, param } = this.scopeSql(scope);
    const [[row], bonuses] = await Promise.all([
      this.dataSource.query(
        `SELECT COALESCE(SUM(gb), 0) AS total,
                COALESCE(SUM(CASE WHEN is_free = 0 OR (free_until IS NOT NULL AND free_until < ?)
                                  THEN gb ELSE 0 END), 0) AS billable
           FROM storage_addons WHERE ${where}`,
        [today, param],
      ),
      this.dataSource.query(
        `SELECT id, gb, DATE_FORMAT(free_until, '%Y-%m-%d') AS freeUntil
           FROM storage_addons
          WHERE ${where} AND is_free = 1 AND (free_until IS NULL OR free_until >= ?)
          ORDER BY id ASC`,
        [param, today],
      ),
    ]);
    return {
      extraGb: Math.max(0, toNumber(row?.total)),
      billableExtraGb: Math.max(0, toNumber(row?.billable)),
      bonuses: (
        bonuses as { id: number; gb: number; freeUntil: string | null }[]
      ).map((b) => ({
        id: Number(b.id),
        gb: toNumber(b.gb),
        freeUntil: b.freeUntil ?? null,
      })),
    };
  }

  /** GB tambahan yang ditagih untuk satu klinik / owner multiklinik saat ini. */
  async billableExtraGb(scope: {
    clinicId?: number;
    ownerId?: number;
  }): Promise<number> {
    return (await this.addonSummary(scope)).billableExtraGb;
  }

  /**
   * GB tambahan yang ditagih bersama perpanjangan klinik ini. A multiklinik
   * branch pays none itself — its pool's add-ons are on the owner's bill.
   * Bonus yang masih dalam masa gratis tidak ditagih.
   */
  async extraGbToBillForClinic(clinicId: number): Promise<number> {
    if ((await this.poolOwnerOf(clinicId)) !== null) return 0;
    return this.billableExtraGb({ clinicId });
  }

  /**
   * Owner membeli storage tambahan: langsung aktif, ditagih di perpanjangan
   * berikutnya. A clinic owner buys for their clinic; a Multi-Klinik Owner
   * (from "Semua cabang" or inside one of their branches) buys for the
   * shared pool. A branch's own owner/manager can't — the pool is the
   * multiklinik owner's to pay for.
   */
  async purchase(actor: StorageActor, gb: number): Promise<StorageQuota> {
    if (!Number.isInteger(gb) || gb < 1 || gb > MAX_ADDON_GB_PER_PURCHASE) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_ADDON_GB',
          message: `Jumlah storage tambahan 1–${MAX_ADDON_GB_PER_PURCHASE} GB`,
        },
      });
    }

    let target: { clinicId: number | null; ownerId: number | null };
    if (actor.role === UserRole.MULTI_CLINIC_OWNER) {
      target = { clinicId: null, ownerId: actor.userId };
    } else {
      const clinicId = actor.clinicId;
      if (!clinicId) {
        throw new ForbiddenException({
          success: false,
          error: { code: 'NO_CLINIC_ASSIGNED', message: 'Pilih klinik dulu' },
        });
      }
      const poolOwner = await this.poolOwnerOf(clinicId);
      if (poolOwner !== null) {
        if (!actor.branchMode || poolOwner !== actor.userId) {
          throw new ForbiddenException({
            success: false,
            error: {
              code: 'POOL_OWNER_ONLY',
              message:
                'Storage cabang ini dipakai bersama. Storage tambahan dibeli oleh owner multiklinik.',
            },
          });
        }
        target = { clinicId: null, ownerId: poolOwner };
      } else {
        target = { clinicId, ownerId: null };
      }
    }

    await this.addonRepository!.save(
      this.addonRepository!.create({
        ...target,
        gb,
        source: StorageAddonSource.PURCHASE,
        note: null,
        createdBy: actor.userId,
      }),
    );
    this.audit(
      actor,
      actor.clinicId ?? null,
      `Beli storage tambahan ${gb} GB (${target.ownerId ? 'jatah bersama multiklinik' : 'klinik'})`,
    );
    return target.ownerId
      ? this.quotaForOwner(target.ownerId)
      : this.quotaForClinic(target.clinicId!);
  }

  /** Super Admin menambah (gb > 0) atau mengurangi (gb < 0) storage tambahan. */
  async adminAdjust(
    actor: StorageActor,
    target: { clinicId?: number; ownerId?: number },
    gb: number,
    note?: string,
    /**
     * Bonus: gratis selama `freeMonths` bulan (null = selamanya), lalu ikut
     * ditagih. Hanya untuk penambahan.
     */
    bonus?: { freeMonths: number | null },
  ): Promise<StorageQuota> {
    if (!!target.clinicId === !!target.ownerId) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_TARGET',
          message: 'Pilih satu klinik atau satu owner multiklinik',
        },
      });
    }
    if (!Number.isInteger(gb) || gb === 0 || Math.abs(gb) > 1000) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_ADDON_GB',
          message:
            'Perubahan storage harus bilangan bulat bukan nol (maks. 1000 GB)',
        },
      });
    }
    if (bonus && gb < 0) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_BONUS',
          message:
            'Bonus hanya untuk menambah storage. Untuk mencabut bonus, gunakan tombol Cabut.',
        },
      });
    }
    if (
      bonus &&
      bonus.freeMonths !== null &&
      (!Number.isInteger(bonus.freeMonths) ||
        bonus.freeMonths < 1 ||
        bonus.freeMonths > 36)
    ) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'INVALID_BONUS',
          message: 'Masa gratis bonus 1–36 bulan',
        },
      });
    }
    const current = await this.extraGb(target);
    if (current + gb < 0) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'ADDON_BELOW_ZERO',
          message: `Storage tambahan saat ini ${current} GB, tidak bisa dikurangi ${Math.abs(gb)} GB`,
        },
      });
    }
    await this.addonRepository!.save(
      this.addonRepository!.create({
        clinicId: target.clinicId ?? null,
        ownerId: target.ownerId ?? null,
        gb,
        source: StorageAddonSource.ADMIN,
        note: note?.trim().slice(0, 255) || null,
        isFree: !!bonus,
        freeUntil:
          bonus && bonus.freeMonths !== null
            ? freeUntilAfterMonths(bonus.freeMonths)
            : null,
        createdBy: actor.userId,
      }),
    );
    const what = bonus
      ? `Bonus storage ${gb} GB gratis ${bonus.freeMonths === null ? 'selamanya' : `${bonus.freeMonths} bulan`}`
      : `${gb > 0 ? 'Tambah' : 'Kurangi'} storage tambahan ${Math.abs(gb)} GB (ditagih)`;
    this.audit(
      actor,
      target.clinicId ?? null,
      `${what} untuk ${target.ownerId ? `owner multiklinik #${target.ownerId}` : `klinik #${target.clinicId}`}${note ? ` — ${note}` : ''}`,
    );
    return target.ownerId
      ? this.quotaForOwner(target.ownerId)
      : this.quotaForClinic(target.clinicId!);
  }

  /** Super Admin: riwayat storage tambahan satu klinik / owner multiklinik. */
  async listAddons(target: { clinicId?: number; ownerId?: number }) {
    const { where, param } = this.scopeSql(target);
    const rows: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT id, gb, source, note, is_free AS isFree,
              DATE_FORMAT(free_until, '%Y-%m-%d') AS freeUntil, created_at AS createdAt
         FROM storage_addons WHERE ${where} ORDER BY id DESC LIMIT 50`,
      [param],
    );
    return rows.map((r) => ({
      id: Number(r.id),
      gb: toNumber(r.gb),
      source: r.source as StorageAddonSource,
      note: (r.note as string | null) ?? null,
      isFree: !!Number(r.isFree),
      freeUntil: (r.freeUntil as string | null) ?? null,
      createdAt: r.createdAt,
    }));
  }

  /** Super Admin mencabut sebuah bonus (jatahnya hilang, tidak pernah ditagih lagi). */
  async revokeBonus(actor: StorageActor, id: number): Promise<void> {
    const row = await this.addonRepository!.findOne({ where: { id } });
    if (!row || !row.isFree) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'BONUS_NOT_FOUND',
          message: 'Bonus storage tidak ditemukan',
        },
      });
    }
    const target = row.ownerId
      ? { ownerId: row.ownerId }
      : { clinicId: row.clinicId! };
    const quota = row.ownerId
      ? await this.quotaForOwner(row.ownerId)
      : await this.quotaForClinic(row.clinicId!);
    if (quota.usedBytes > quota.limitBytes - row.gb * GB) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'BONUS_IN_USE',
          message: `Bonus ${row.gb} GB tidak bisa dicabut: pemakaian ${formatBytes(quota.usedBytes)} akan melebihi jatah.`,
        },
      });
    }
    await this.addonRepository!.delete({ id });
    this.audit(
      actor,
      row.clinicId ?? null,
      `Cabut bonus storage ${row.gb} GB untuk ${target.ownerId ? `owner multiklinik #${target.ownerId}` : `klinik #${target.clinicId}`}`,
    );
  }

  private audit(actor: StorageActor, clinicId: number | null, label: string) {
    void this.auditLog?.record({
      clinicId,
      actorId: actor.userId,
      actorName: actor.name ?? 'Unknown',
      actorRole: actor.actorRole ?? actor.role,
      actionType: AuditActionType.UPDATE,
      entityType: 'StorageAddon',
      entityLabel: label.slice(0, 255),
      status: AuditStatus.SUCCESS,
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
          extraGb: quota.extraGb,
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
}
