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
import { KfaService } from '../satusehat/kfa/kfa.service';
import {
  SearchKfaQueryDto,
  SearchSaranaQueryDto,
  WILAYAH_LEVELS,
  WilayahLevel,
  WilayahV2QueryDto,
} from './dto/master-data.dto';

@Controller('api/master-data')
export class MasterDataController {
  constructor(
    private readonly masterDataService: MasterDataService,
    private readonly kfaService: KfaService,
  ) {}

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
  async getCities(
    @Query('province_codes') provinceCodes?: string,
    @Query('codes') codes?: string,
  ) {
    const result = await this.masterDataService.getCities(provinceCodes, codes);
    return { success: true, data: result.data };
  }

  @Get('districts')
  @Public()
  async getDistricts(
    @Query('city_codes') cityCodes?: string,
    @Query('codes') codes?: string,
  ) {
    const result = await this.masterDataService.getDistricts(cityCodes, codes);
    return { success: true, data: result.data };
  }

  @Get('sub-districts')
  @Public()
  async getSubDistricts(
    @Query('district_codes') districtCodes?: string,
    @Query('codes') codes?: string,
  ) {
    const result = await this.masterDataService.getSubDistricts(
      districtCodes,
      codes,
    );
    return { success: true, data: result.data };
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

  // ── Kamus Farmasi & Alat Kesehatan (KFA) ──────────────────────────────

  @Get('kfa/products')
  @ApiTags('master-data')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Cari obat/alkes di KFA SATUSEHAT' })
  async searchKfa(@Query() query: SearchKfaQueryDto) {
    return ApiResponse.success(
      await this.kfaService.search({
        keyword: query.keyword,
        page: query.page,
        size: query.size,
        productType: query.product_type,
      }),
    );
  }

  @Get('kfa/products/:kfaCode')
  @ApiTags('master-data')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Detail produk KFA (bentuk sediaan, rute, zat aktif)',
  })
  async getKfaProduct(@Param('kfaCode') kfaCode: string) {
    return ApiResponse.success(await this.kfaService.getProduct(kfaCode));
  }
}
