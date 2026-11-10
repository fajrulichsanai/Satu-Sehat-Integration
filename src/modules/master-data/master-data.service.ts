import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SatusehatGlobalOauthService } from '../satusehat/satusehat-global-oauth.service';
import { SatusehatEnvironment } from '../../enums/satusehat-environment.enum';
import {
  ProvinceDto,
  CityDto,
  DistrictDto,
  SubDistrictDto,
  MasterDataResponseDto,
  MsiRawResponse,
  SaranaItem,
  SaranaListResponse,
  SearchSaranaQueryDto,
  WilayahItemDto,
  WilayahLevel,
  WilayahV2QueryDto,
  WilayahV2Response,
} from './dto/master-data.dto';

const SATUSEHAT_BASE: Record<SatusehatEnvironment, string> = {
  [SatusehatEnvironment.SANDBOX]: 'https://api-satusehat-stg.dto.kemkes.go.id',
  [SatusehatEnvironment.PRODUCTION]: 'https://api-satusehat.kemkes.go.id',
};

/** Bangun query string dengan encoding aman, buang nilai kosong. */
function toQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  }
  // SATUSEHAT memakai daftar kode dipisah koma apa adanya (codes=11,12)
  const str = qs.toString().replace(/%2C/gi, ',');
  return str ? `?${str}` : '';
}

@Injectable()
export class MasterDataService {
  private readonly logger = new Logger(MasterDataService.name);
  private environment: SatusehatEnvironment = SatusehatEnvironment.SANDBOX;

  constructor(
    private readonly oauthService: SatusehatGlobalOauthService,
    private readonly configService: ConfigService,
  ) {
    const env = this.configService.get<string>(
      'SATUSEHAT_ENVIRONMENT',
      'sandbox',
    );
    this.environment =
      env === 'production'
        ? SatusehatEnvironment.PRODUCTION
        : SatusehatEnvironment.SANDBOX;
  }

  async getProvinces(
    codes?: string,
  ): Promise<MasterDataResponseDto<ProvinceDto>> {
    return this.fetchMasterData(`provinces${toQuery({ codes })}`);
  }

  async getCities(
    provinceCodes?: string,
    codes?: string,
  ): Promise<MasterDataResponseDto<CityDto>> {
    return this.fetchMasterData(
      `cities${toQuery({ province_codes: provinceCodes, codes })}`,
    );
  }

  async getDistricts(
    cityCodes?: string,
    codes?: string,
  ): Promise<MasterDataResponseDto<DistrictDto>> {
    return this.fetchMasterData(
      `districts${toQuery({ city_codes: cityCodes, codes })}`,
    );
  }

  async getSubDistricts(
    districtCodes?: string,
    codes?: string,
  ): Promise<MasterDataResponseDto<SubDistrictDto>> {
    return this.fetchMasterData(
      `sub-districts${toQuery({ district_codes: districtCodes, codes })}`,
    );
  }

  /**
   * Master Wilayah versi 2 — sama seperti v1 tapi berhalaman (meta.page & cursors).
   * GET /masterdata/v2/{provinces|cities|districts|sub-districts}
   */
  async getWilayahV2(
    level: WilayahLevel,
    query: WilayahV2QueryDto,
  ): Promise<WilayahV2Response> {
    const raw = (await this.fetchMasterData(
      `${level}${toQuery({ ...query })}`,
      'v2',
    )) as {
      data?: WilayahItemDto[];
      meta?: WilayahV2Response['meta'];
    };
    return { items: raw.data ?? [], meta: raw.meta ?? null };
  }

  /**
   * Master Sarana Index (MSI) — cari fasilitas kesehatan terdaftar di SATUSEHAT.
   * GET /masterdata/v1/mastersaranaindex/mastersarana
   */
  async searchSarana(query: SearchSaranaQueryDto): Promise<SaranaListResponse> {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    }

    const result = await this.fetchMsi(params);
    return {
      page: result.page ?? query.page,
      totalPage: result.total_page ?? 0,
      items: result.data ?? [],
    };
  }

  async getSaranaByKodeSatusehat(kodeSatusehat: string): Promise<SaranaItem> {
    if (!/^\d{10}$/.test(kodeSatusehat)) {
      throw new BadRequestException('Kode SATUSEHAT harus 10 digit angka');
    }
    const params = new URLSearchParams({
      page: '1',
      limit: '1',
      kode_satusehat: kodeSatusehat,
    });
    const result = await this.fetchMsi(params);
    const item = result.data?.[0];
    if (!item) {
      throw new NotFoundException(
        `Sarana dengan kode SATUSEHAT ${kodeSatusehat} tidak ditemukan`,
      );
    }
    return item;
  }

  private async fetchMsi(params: URLSearchParams): Promise<MsiRawResponse> {
    const baseUrl = SATUSEHAT_BASE[this.environment];
    const url = `${baseUrl}/masterdata/v1/mastersaranaindex/mastersarana?${params.toString()}`;
    const token = await this.oauthService.getAccessToken(this.environment);

    this.logger.debug(`Fetching MSI: ${url}`);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {
      this.logger.error(`MSI request failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Koneksi ke SATUSEHAT gagal');
    }

    const body = (await response
      .json()
      .catch(() => null)) as MsiRawResponse | null;

    if (!response.ok) {
      const message = body?.message || response.statusText;
      this.logger.error(`MSI API error: ${response.status} - ${message}`);
      if (response.status >= 400 && response.status < 500) {
        throw new BadRequestException(`SATUSEHAT MSI: ${message}`);
      }
      throw new ServiceUnavailableException(
        'Gagal mengambil data Master Sarana Index dari SATUSEHAT',
      );
    }

    if (!body) {
      throw new ServiceUnavailableException(
        'Respons Master Sarana Index tidak valid',
      );
    }
    return body;
  }

  private async fetchMasterData(
    endpoint: string,
    version: 'v1' | 'v2' = 'v1',
  ): Promise<any> {
    try {
      const token = await this.oauthService.getAccessToken(this.environment);
      const baseUrl = SATUSEHAT_BASE[this.environment];
      const url = `${baseUrl}/masterdata/${version}/${endpoint}`;

      this.logger.debug(`Fetching: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.error(
          `Satu Sehat API error: ${response.status} - ${response.statusText}`,
        );
        throw new Error(`API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      this.logger.error(`Failed to fetch master data: ${error.message}`);
      throw new ServiceUnavailableException(
        'Failed to fetch master data from Satu Sehat',
      );
    }
  }
}
