import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

@Injectable()
export class KfaService {
  private readonly logger = new Logger(KfaService.name);
  private readonly environment: SatusehatEnvironment;
  private readonly detailCache = new Map<
    string,
    { at: number; product: KfaProduct }
  >();

  constructor(
    private readonly oauth: SatusehatGlobalOauthService,
    configService: ConfigService,
  ) {
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
    const body = await this.get(`/kfa-v2/products?${qs.toString()}`);
    if (!body?.result?.kfa_code) {
      throw new NotFoundException(`Kode KFA ${kfaCode} tidak ditemukan`);
    }
    const product = normalizeKfaProduct(body.result);
    this.detailCache.set(kfaCode, { at: Date.now(), product });
    return product;
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
