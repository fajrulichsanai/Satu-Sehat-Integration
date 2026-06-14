import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SatusehatGlobalOauthService } from '../satusehat/satusehat-global-oauth.service';
import { SatusehatEnvironment } from '../../enums/satusehat-environment.enum';
import {
  ProvinceDto,
  CityDto,
  DistrictDto,
  SubDistrictDto,
  MasterDataResponseDto,
} from './dto/master-data.dto';

const SATUSEHAT_BASE: Record<SatusehatEnvironment, string> = {
  [SatusehatEnvironment.SANDBOX]:
    'https://api-satusehat-stg.dto.kemkes.go.id',
  [SatusehatEnvironment.PRODUCTION]:
    'https://api-satusehat.kemkes.go.id',
};

@Injectable()
export class MasterDataService {
  private readonly logger = new Logger(MasterDataService.name);
  private environment: SatusehatEnvironment = SatusehatEnvironment.SANDBOX;

  constructor(
    private readonly oauthService: SatusehatGlobalOauthService,
    private readonly configService: ConfigService,
  ) {
    const env = this.configService.get<string>('SATUSEHAT_ENVIRONMENT', 'sandbox');
    this.environment = env === 'production'
      ? SatusehatEnvironment.PRODUCTION
      : SatusehatEnvironment.SANDBOX;
  }

  async getProvinces(codes?: string): Promise<MasterDataResponseDto<ProvinceDto>> {
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
