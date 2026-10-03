import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MasterDataService } from './master-data.service';
import { Public } from '../auth/decorators/public.decorator';
import { ApiResponse } from '../../common/response/api-response';
import {
  SearchSaranaQueryDto,
  WILAYAH_LEVELS,
  WilayahLevel,
  WilayahV2QueryDto,
} from './dto/master-data.dto';

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
  async getCities(
    @Query('province_codes') provinceCodes?: string,
    @Query('codes') codes?: string,
  ) {
    return this.masterDataService.getCities(provinceCodes, codes);
  }

  @Get('districts')
  @Public()
  async getDistricts(
    @Query('city_codes') cityCodes?: string,
    @Query('codes') codes?: string,
  ) {
    return this.masterDataService.getDistricts(cityCodes, codes);
  }

  @Get('sub-districts')
  @Public()
  async getSubDistricts(
    @Query('district_codes') districtCodes?: string,
    @Query('codes') codes?: string,
  ) {
    return this.masterDataService.getSubDistricts(districtCodes, codes);
  }

  // ── Master Wilayah v2 (berhalaman) ────────────────────────────────────

  @Get('v2/:level')
  @ApiTags('master-data')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary:
      'Master Wilayah v2 SATUSEHAT: provinces | cities | districts | sub-districts',
  })
  async getWilayahV2(
    @Param('level') level: string,
    @Query() query: WilayahV2QueryDto,
  ) {
    if (!WILAYAH_LEVELS.includes(level as WilayahLevel)) {
      throw new BadRequestException(
        `level harus salah satu dari: ${WILAYAH_LEVELS.join(', ')}`,
      );
    }
    return ApiResponse.success(
      await this.masterDataService.getWilayahV2(level as WilayahLevel, query),
    );
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
