import { Controller, Get, Query } from '@nestjs/common';
import { MasterDataService } from './master-data.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('api/master-data')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  // SatuSehat's masterdata API replies with its own envelope
  // ({status, error, message, data}), not this app's {success, data}
  // convention — re-wrap here so the frontend's generic apiClient unwrap
  // (which only fires on `success: true`) actually kicks in.

  @Get('provinces')
  @Public()
  async getProvinces(@Query('codes') codes?: string) {
    const result = await this.masterDataService.getProvinces(codes);
    return { success: true, data: result.data };
  }

  @Get('cities')
  @Public()
  async getCities(@Query('province_codes') provinceCodes?: string) {
    const result = await this.masterDataService.getCities(provinceCodes);
    return { success: true, data: result.data };
  }

  @Get('districts')
  @Public()
  async getDistricts(@Query('city_codes') cityCodes?: string) {
    const result = await this.masterDataService.getDistricts(cityCodes);
    return { success: true, data: result.data };
  }

  @Get('sub-districts')
  @Public()
  async getSubDistricts(@Query('district_codes') districtCodes?: string) {
    const result = await this.masterDataService.getSubDistricts(districtCodes);
    return { success: true, data: result.data };
  }
}
