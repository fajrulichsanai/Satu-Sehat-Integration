import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Brackets, Repository } from 'typeorm';
import { KfaProductEntity } from './entities/kfa-product.entity';
import { SatusehatEnvironment } from '../../../enums/satusehat-environment.enum';
import { SatusehatGlobalOauthService } from '../satusehat-global-oauth.service';

/**
 * Kamus Farmasi & Alat Kesehatan (KFA) SATUSEHAT.
 * Ref: https://satusehat.kemkes.go.id/platform/docs/id/master-data/kfa/rest-api-kfa/
 *
 *   GET /kfa-v2/products/all  — pencarian (keyword, product_type, page, size)
 *   GET /kfa-v2/products      — detail (identifier=kfa|nie|lkpp, code)
 *
 * Memakai kredensial global (SATUSEHAT_GLOBAL_CLIENT_ID/SECRET) seperti
 * master data lain, sehingga dokter bisa mencari obat walau klinik belum
 * mengonfigurasi SATUSEHAT-nya sendiri.
 *
 * Katalog obat juga disalin ke tabel `kfa_products` (syncCatalog): sekali
 * penuh, lalu bertahap memakai from_date. Begitu tabel terisi, pencarian
 * obat memakai data lokal; API KFA tetap dipakai untuk detail produk.
 */

const BASE: Record<SatusehatEnvironment, string> = {
  [SatusehatEnvironment.SANDBOX]: 'https://api-satusehat-stg.dto.kemkes.go.id',
  [SatusehatEnvironment.PRODUCTION]: 'https://api-satusehat.kemkes.go.id',
};

export interface KfaCoding {
  code: string;
  name: string;
}

export interface KfaIngredient {
  kfaCode: string;
  name: string;
  /** mis. "300 mg" */
  strength: string | null;
}

export interface KfaProduct {
  kfaCode: string;
  name: string;
  active: boolean;
  /** "farmasi" / "alkes" */
  group: string | null;
  dosageForm: KfaCoding | null;
  route: KfaCoding | null;
  uom: string | null;
  manufacturer: string | null;
  nie: string | null;
  generic: boolean | null;
  template: KfaCoding | null;
  activeIngredients: KfaIngredient[];
}

export interface KfaSearchResult {
  total: number;
  page: number;
  size: number;
  items: KfaProduct[];
}

/** KFA kadang mengisi `false` untuk field kosong (mis. dosage_form). */
const coding = (raw: any): KfaCoding | null =>
  raw && typeof raw.code === 'string' && raw.code
    ? { code: raw.code, name: String(raw.name ?? '') }
    : null;

const text = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v : null;

export function normalizeKfaProduct(raw: any): KfaProduct {
  return {
    kfaCode: String(raw?.kfa_code ?? ''),
    name: String(raw?.name ?? ''),
    active: raw?.active !== false,
    group: text(raw?.farmalkes_type?.group),
    dosageForm: coding(raw?.dosage_form),
    route: coding(raw?.rute_pemberian),
    uom: text(raw?.uom?.name),
    manufacturer: text(raw?.manufacturer),
    nie: text(raw?.nie),
    generic: typeof raw?.generik === 'boolean' ? raw.generik : null,
    template: raw?.product_template?.kfa_code
      ? {
          code: String(raw.product_template.kfa_code),
          name: String(
            raw.product_template.display_name ??
              raw.product_template.name ??
              '',
          ),
        }
      : null,
    activeIngredients: Array.isArray(raw?.active_ingredients)
      ? raw.active_ingredients
          .filter((i: any) => i?.kfa_code)
          .map((i: any) => ({
            kfaCode: String(i.kfa_code),
            name: String(i.zat_aktif ?? ''),
            strength: text(i.kekuatan_zat_aktif),
          }))
      : [],
  };
}

const DETAIL_TTL_MS = 24 * 60 * 60 * 1000;
const LOCAL_COUNT_TTL_MS = 5 * 60 * 1000;
const SYNC_PAGE_SIZE = 100;
const SYNC_MAX_PAGES = 5000;

export interface KfaCatalogStatus {
  products: number;
  lastSyncedAt: Date | null;
  lastKfaUpdate: Date | null;
  running: boolean;
}

/** "2023-09-21 07:17:24" (UTC) → Date */
function kfaTimestamp(raw: unknown): Date | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const d = new Date(`${raw.trim().replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toEntity(raw: any, now: Date): KfaProductEntity {
  const p = normalizeKfaProduct(raw);
  return {
    kfaCode: p.kfaCode,
    name: p.name.slice(0, 512),
    active: p.active,
    group: p.group,
    dosageFormCode: p.dosageForm?.code ?? null,
    dosageFormName: p.dosageForm?.name ?? null,
    routeCode: p.route?.code ?? null,
    routeName: p.route?.name ?? null,
    uom: p.uom,
    manufacturer: p.manufacturer?.slice(0, 255) ?? null,
    nie: p.nie,
    generic: p.generic,
    templateCode: p.template?.code ?? null,
    templateName: p.template?.name.slice(0, 512) ?? null,
    activeIngredients: p.activeIngredients,
    kfaUpdatedAt: kfaTimestamp(raw?.updated_at),
    syncedAt: now,
  };
}

function fromEntity(e: KfaProductEntity): KfaProduct {
  return {
    kfaCode: e.kfaCode,
    name: e.name,
    active: e.active,
    group: e.group,
    dosageForm: e.dosageFormCode
      ? { code: e.dosageFormCode, name: e.dosageFormName ?? '' }
      : null,
    route: e.routeCode ? { code: e.routeCode, name: e.routeName ?? '' } : null,
    uom: e.uom,
    manufacturer: e.manufacturer,
    nie: e.nie,
    generic: e.generic,
    template: e.templateCode
      ? { code: e.templateCode, name: e.templateName ?? '' }
      : null,
    activeIngredients: e.activeIngredients ?? [],
  };
}

@Injectable()
export class KfaService {
  private readonly logger = new Logger(KfaService.name);
  private readonly environment: SatusehatEnvironment;
  private readonly detailCache = new Map<
    string,
    { at: number; product: KfaProduct }
  >();

  private localCount: { at: number; count: number } | null = null;
  private syncing: Promise<{ pages: number; saved: number }> | null = null;
  private readonly scheduledSync: boolean;

  constructor(
    private readonly oauth: SatusehatGlobalOauthService,
    configService: ConfigService,
    @InjectRepository(KfaProductEntity)
    private readonly catalog: Repository<KfaProductEntity>,
  ) {
    this.scheduledSync =
      configService.get<string>('KFA_CATALOG_SYNC', 'false') === 'true';
    this.environment =
      configService.get<string>('SATUSEHAT_ENVIRONMENT', 'sandbox') ===
      'production'
        ? SatusehatEnvironment.PRODUCTION
        : SatusehatEnvironment.SANDBOX;
  }

  async search(params: {
    keyword: string;
    page?: number;
    size?: number;
    productType?: 'farmasi' | 'alkes';
  }): Promise<KfaSearchResult> {
    if (
      (params.productType ?? 'farmasi') === 'farmasi' &&
      (await this.hasLocalCatalog())
    ) {
      return this.searchLocal(
        params.keyword,
        params.page ?? 1,
        params.size ?? 20,
      );
    }
    const qs = new URLSearchParams({
      page: String(params.page ?? 1),
      size: String(params.size ?? 20),
      product_type: params.productType ?? 'farmasi',
      keyword: params.keyword,
    });
    const body = await this.get(`/kfa-v2/products/all?${qs.toString()}`);
    const data: any[] = body?.items?.data ?? [];
    return {
      total: Number(body?.total ?? data.length),
      page: Number(body?.page ?? params.page ?? 1),
      size: Number(body?.size ?? params.size ?? 20),
      // Varian tanpa kode (mis. "kfa_code": "/") tidak bisa dipakai di FHIR
      items: data
        .map(normalizeKfaProduct)
        .filter((p) => /^\d{8}$/.test(p.kfaCode)),
    };
  }

  /** Detail produk berdasarkan kode KFA (cache 24 jam). */
  async getProduct(kfaCode: string): Promise<KfaProduct> {
    if (!/^\d{8}$/.test(kfaCode)) {
      throw new BadRequestException('Kode KFA harus 8 digit angka');
    }
    const cached = this.detailCache.get(kfaCode);
    if (cached && Date.now() - cached.at < DETAIL_TTL_MS) return cached.product;

    const qs = new URLSearchParams({ identifier: 'kfa', code: kfaCode });
    let body: any;
    try {
      body = await this.get(`/kfa-v2/products?${qs.toString()}`);
    } catch (err) {
      // API KFA terputus — pakai salinan lokal bila ada
      if (!(err instanceof ServiceUnavailableException)) throw err;
      const local = await this.catalog.findOne({ where: { kfaCode } });
      if (!local) throw err;
      return fromEntity(local);
    }
    if (!body?.result?.kfa_code) {
      throw new NotFoundException(`Kode KFA ${kfaCode} tidak ditemukan`);
    }
    const product = normalizeKfaProduct(body.result);
    this.detailCache.set(kfaCode, { at: Date.now(), product });
    return product;
  }

  // ── Katalog lokal ──────────────────────────────────────────────────────

  private async hasLocalCatalog(): Promise<boolean> {
    if (
      !this.localCount ||
      Date.now() - this.localCount.at > LOCAL_COUNT_TTL_MS
    ) {
      this.localCount = { at: Date.now(), count: await this.catalog.count() };
    }
    return this.localCount.count > 0;
  }

  /** Semua kata kunci harus muncul di nama produk (urutan bebas). */
  private async searchLocal(
    keyword: string,
    page: number,
    size: number,
  ): Promise<KfaSearchResult> {
    const words = keyword
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.replace(/[%_\\]/g, ''))
      .filter(Boolean)
      .slice(0, 6);
    const qb = this.catalog
      .createQueryBuilder('p')
      .where('p.active = :active', { active: true });
    if (words.length) {
      qb.andWhere(
        new Brackets((b) =>
          words.forEach((w, i) =>
            b.andWhere(`LOWER(p.name) LIKE :w${i}`, { [`w${i}`]: `%${w}%` }),
          ),
        ),
      );
    }
    const [rows, total] = await qb
      .orderBy('p.name', 'ASC')
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();
    return { total, page, size, items: rows.map(fromEntity) };
  }

  async catalogStatus(): Promise<KfaCatalogStatus> {
    const raw = await this.catalog
      .createQueryBuilder('p')
      .select('COUNT(*)', 'products')
      .addSelect('MAX(p.synced_at)', 'lastSyncedAt')
      .addSelect('MAX(p.kfa_updated_at)', 'lastKfaUpdate')
      .getRawOne<{
        products: string;
        lastSyncedAt: Date | null;
        lastKfaUpdate: Date | null;
      }>();
    return {
      products: Number(raw?.products ?? 0),
      lastSyncedAt: raw?.lastSyncedAt ? new Date(raw.lastSyncedAt) : null,
      lastKfaUpdate: raw?.lastKfaUpdate ? new Date(raw.lastKfaUpdate) : null,
      running: this.syncing !== null,
    };
  }

  /**
   * Salin katalog obat KFA ke `kfa_products`. Tanpa `full`, hanya produk yang
   * berubah sejak pembaruan terakhir (from_date, mundur 1 hari agar aman).
   * Hanya satu sinkronisasi berjalan pada satu waktu.
   */
  syncCatalog(
    options: { full?: boolean } = {},
  ): Promise<{ pages: number; saved: number }> {
    if (!this.syncing) {
      this.syncing = this.runSync(options.full ?? false)
        .catch((err: Error) => {
          this.logger.error(`Sinkron katalog KFA gagal: ${err.message}`);
          throw err;
        })
        .finally(() => {
          this.syncing = null;
          this.localCount = null;
        });
    }
    return this.syncing;
  }

  /** Sinkron harian 02:00, aktif bila KFA_CATALOG_SYNC=true */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledCatalogSync(): Promise<void> {
    if (!this.scheduledSync) return;
    try {
      const { saved } = await this.syncCatalog();
      this.logger.log(`Sinkron katalog KFA: ${saved} produk diperbarui`);
    } catch {
      // sudah dicatat di syncCatalog
    }
  }

  private async runSync(
    full: boolean,
  ): Promise<{ pages: number; saved: number }> {
    const status = full ? null : await this.catalogStatus();
    const day = (d: Date) => d.toISOString().slice(0, 10);
    const from =
      status?.lastKfaUpdate && status.products > 0
        ? day(new Date(status.lastKfaUpdate.getTime() - 24 * 60 * 60 * 1000))
        : null;

    let pages = 0;
    let saved = 0;
    for (let page = 1; page <= SYNC_MAX_PAGES; page++) {
      const qs = new URLSearchParams({
        page: String(page),
        size: String(SYNC_PAGE_SIZE),
        product_type: 'farmasi',
        ...(from ? { from_date: from, to_date: day(new Date()) } : {}),
      });
      const body = await this.get(`/kfa-v2/products/all?${qs.toString()}`);
      const data: any[] = body?.items?.data ?? [];
      pages++;
      const now = new Date();
      const rows = data
        .filter((raw) => /^\d{8}$/.test(String(raw?.kfa_code ?? '')))
        .map((raw) => toEntity(raw, now));
      if (rows.length) {
        await this.catalog.upsert(rows, ['kfaCode']);
        saved += rows.length;
      }
      const total = Number(body?.total ?? 0);
      if (
        data.length < SYNC_PAGE_SIZE ||
        (total && page * SYNC_PAGE_SIZE >= total)
      )
        break;
    }
    return { pages, saved };
  }

  private async get(path: string): Promise<any> {
    const token = await this.oauth.getAccessToken(this.environment);
    let response: Response;
    try {
      response = await fetch(`${BASE[this.environment]}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      this.logger.error(`KFA request failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Koneksi ke KFA SATUSEHAT gagal');
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      this.logger.warn(`KFA API error: ${response.status}`);
      if (response.status === 404) {
        throw new NotFoundException('Produk KFA tidak ditemukan');
      }
      if (response.status >= 400 && response.status < 500) {
        throw new BadRequestException(
          `KFA SATUSEHAT menolak permintaan (HTTP ${response.status})`,
        );
      }
      throw new ServiceUnavailableException(
        'Layanan KFA SATUSEHAT sedang bermasalah',
      );
    }
    return body;
  }
}
