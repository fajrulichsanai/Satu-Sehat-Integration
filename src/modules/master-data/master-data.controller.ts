import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MasterDataService } from './master-data.service';
import { Public } from '../auth/decorators/public.decorator';
import { ApiResponse } from '../../common/response/api-response';
import { KfaService } from '../satusehat/kfa/kfa.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../enums/user-role.enum';
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

  @Get('kfa/catalog/status')
  @ApiTags('master-data')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Status salinan lokal katalog obat KFA' })
  async kfaCatalogStatus() {
    return ApiResponse.success(await this.kfaService.catalogStatus());
  }

  @Post('kfa/catalog/sync')
  @HttpCode(202)
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiTags('master-data')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Mulai sinkron katalog obat KFA ke database lokal (super admin)',
  })
  async syncKfaCatalog(@Body() body: { full?: boolean }) {
    // Sinkron penuh bisa memakan waktu lama — jalankan di latar belakang
    this.kfaService
      .syncCatalog({ full: body?.full === true })
      .catch(() => undefined);
    return ApiResponse.success(await this.kfaService.catalogStatus());
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
