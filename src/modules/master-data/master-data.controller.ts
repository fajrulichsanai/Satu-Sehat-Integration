import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MasterDataService } from './master-data.service';
import { Public } from '../auth/decorators/public.decorator';
import { ApiResponse } from '../../common/response/api-response';
import { SearchSaranaQueryDto } from './dto/master-data.dto';

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

  // ── Master Sarana Index (MSI) ─────────────────────────────────────────
  // Butuh login (tidak @Public) agar kuota API SATUSEHAT tidak disalahgunakan.

  @Get('sarana')
  @ApiTags('master-data')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Cari fasilitas kesehatan di Master Sarana Index SATUSEHAT',
  })
  async searchSarana(@Query() query: SearchSaranaQueryDto) {
    return ApiResponse.success(
      await this.masterDataService.searchSarana(query),
    );
  }

  @Get('sarana/:kodeSatusehat')
  @ApiTags('master-data')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Detail sarana berdasarkan kode SATUSEHAT (10 digit)',
  })
  async getSarana(@Param('kodeSatusehat') kodeSatusehat: string) {
    return ApiResponse.success(
      await this.masterDataService.getSaranaByKodeSatusehat(kodeSatusehat),
    );
  }
}
