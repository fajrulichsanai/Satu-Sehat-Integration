import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasterDataService } from './master-data.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('api/master-data')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) {}

  @Get('provinces')
  @Public()
  async getProvinces(@Query('codes') codes?: string) {
    return this.masterDataService.getProvinces(codes);
  }

  @Get('cities')
  @Public()
  async getCities(@Query('province_codes') provinceCodes?: string) {
    return this.masterDataService.getCities(provinceCodes);
  }

  @Get('districts')
  @Public()
  async getDistricts(@Query('city_codes') cityCodes?: string) {
    return this.masterDataService.getDistricts(cityCodes);
  }

  @Get('sub-districts')
  @Public()
  async getSubDistricts(@Query('district_codes') districtCodes?: string) {
    return this.masterDataService.getSubDistricts(districtCodes);
  }
}
