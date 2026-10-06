import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../enums/user-role.enum';
import { ApiResponse } from '../../common/response/api-response';
import { FeaturesService, type FeatureActor } from './features.service';
import { CreateCustomFeatureDto, SetFeatureDto } from './dto/features.dto';

@ApiTags('features')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class FeaturesController {
  constructor(private readonly features: FeaturesService) {}

  @Get('features/me')
  @ApiOperation({ summary: 'Fitur yang aktif untuk user yang sedang login' })
  async me(@CurrentUser() user: FeatureActor) {
    return ApiResponse.success(await this.features.effectiveFor(user));
  }

  // ── Owner: fitur per user di kliniknya ──

  @Get('users/:id/features')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Pengaturan fitur seorang user' })
  async userFeatures(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: FeatureActor,
  ) {
    return ApiResponse.success(await this.features.userFeatures(user, id));
  }

  @Put('users/:id/features')
  @Roles(UserRole.OWNER, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Nyalakan/matikan fitur untuk seorang user' })
  async setUserFeature(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetFeatureDto,
    @CurrentUser() user: FeatureActor,
  ) {
    return ApiResponse.success(
      await this.features.setUserFeature(user, id, dto.featureKey, dto.enabled),
    );
  }

  // ── Super admin: fitur per klinik & fitur custom ──

  @Get('super-admin/clinics/:id/features')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Fitur yang tersedia untuk sebuah klinik' })
  async clinicFeatures(@Param('id', ParseIntPipe) id: number) {
    return ApiResponse.success(await this.features.clinicFeatures(id));
  }

  @Put('super-admin/clinics/:id/features')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Nyalakan/matikan fitur untuk sebuah klinik' })
  async setClinicFeature(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetFeatureDto,
    @CurrentUser() user: FeatureActor,
  ) {
    return ApiResponse.success(
      await this.features.setClinicFeature(
        id,
        dto.featureKey,
        dto.enabled,
        user.userId,
      ),
    );
  }

  @Get('super-admin/custom-features')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Daftar fitur custom' })
  async listCustom() {
    return ApiResponse.success(await this.features.listCustom());
  }

  @Post('super-admin/custom-features')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Daftarkan fitur custom baru' })
  async createCustom(
    @Body() dto: CreateCustomFeatureDto,
    @CurrentUser() user: FeatureActor,
  ) {
    return ApiResponse.success(
      await this.features.createCustom(dto, user.userId),
    );
  }

  @Delete('super-admin/custom-features/:id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Hapus fitur custom (beserta pengaturannya)' })
  async deleteCustom(@Param('id', ParseIntPipe) id: number) {
    await this.features.deleteCustom(id);
    return ApiResponse.success(null, 'Fitur custom dihapus');
  }
}
