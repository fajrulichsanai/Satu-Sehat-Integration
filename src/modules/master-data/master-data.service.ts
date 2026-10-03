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
} from './dto/master-data.dto';

const SATUSEHAT_BASE: Record<SatusehatEnvironment, string> = {
  [SatusehatEnvironment.SANDBOX]: 'https://api-satusehat-stg.dto.kemkes.go.id',
  [SatusehatEnvironment.PRODUCTION]: 'https://api-satusehat.kemkes.go.id',
};

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
    const params = codes ? `?codes=${codes}` : '';
    return this.fetchMasterData(`provinces${params}`);
  }

  async getCities(
    provinceCodes?: string,
  ): Promise<MasterDataResponseDto<CityDto>> {
    const params = provinceCodes ? `?province_codes=${provinceCodes}` : '';
    return this.fetchMasterData(`cities${params}`);
  }

  async getDistricts(
    cityCodes?: string,
  ): Promise<MasterDataResponseDto<DistrictDto>> {
    const params = cityCodes ? `?city_codes=${cityCodes}` : '';
    return this.fetchMasterData(`districts${params}`);
  }

  async getSubDistricts(
    districtCodes?: string,
  ): Promise<MasterDataResponseDto<SubDistrictDto>> {
    const params = districtCodes ? `?district_codes=${districtCodes}` : '';
    return this.fetchMasterData(`sub-districts${params}`);
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

  private async fetchMasterData(endpoint: string): Promise<any> {
    try {
      const token = await this.oauthService.getAccessToken(this.environment);
      const baseUrl = SATUSEHAT_BASE[this.environment];
      const url = `${baseUrl}/masterdata/v1/${endpoint}`;

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
