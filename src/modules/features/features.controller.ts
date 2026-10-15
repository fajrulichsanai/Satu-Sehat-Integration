import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { UserRole } from '../../enums/user-role.enum';
import { ApiResponse } from '../../common/response/api-response';
import { FeaturesService, type FeatureActor } from './features.service';
import { SetEnabledDto, SetFeatureDto } from './dto/features.dto';
import { PlatformSettingsService } from './platform-settings.service';

@ApiTags('features')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class FeaturesController {
  constructor(
    private readonly features: FeaturesService,
    private readonly platform: PlatformSettingsService,
  ) {}

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

  // ── Super admin: fitur per klinik ──

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

  // ── Super admin: pengaturan platform ──

  @Get('super-admin/platform-settings')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Pengaturan platform (saklar global SATUSEHAT)' })
  async platformSettings() {
    return ApiResponse.success(await this.platform.get());
  }

  @Put('super-admin/platform-settings/satusehat')
  @Roles(UserRole.SUPER_ADMIN)
  @UseInterceptors(AuditInterceptor)
  @Audit('PlatformSetting', AuditActionType.UPDATE)
  @ApiOperation({
    summary: 'Nyalakan/matikan SATUSEHAT untuk seluruh klinik (saklar global)',
  })
  async setPlatformSatusehat(
    @Body() dto: SetEnabledDto,
    @CurrentUser() user: FeatureActor,
    @Req() req: { auditEntityLabel?: string },
  ) {
    req.auditEntityLabel = `SATUSEHAT global ${dto.enabled ? 'dinyalakan' : 'dimatikan'}`;
    return ApiResponse.success(
      await this.platform.setSatusehatEnabled(dto.enabled, user.userId),
    );
  }

  @Put('super-admin/platform-settings/auto-purge')
  @Roles(UserRole.SUPER_ADMIN)
  @UseInterceptors(AuditInterceptor)
  @Audit('PlatformSetting', AuditActionType.UPDATE)
  @ApiOperation({
    summary:
      'Nyalakan/matikan penghapusan otomatis data klinik yang berhenti berlangganan',
  })
  async setPlatformAutoPurge(
    @Body() dto: SetEnabledDto,
    @CurrentUser() user: FeatureActor,
    @Req() req: { auditEntityLabel?: string },
  ) {
    req.auditEntityLabel = `Hapus otomatis data klinik ${dto.enabled ? 'dinyalakan' : 'dimatikan'}`;
    return ApiResponse.success(
      await this.platform.setAutoPurgeEnabled(dto.enabled, user.userId),
    );
  }

  // ── Owner klinik: saklar SATUSEHAT kliniknya ──

  @Get('features/clinic/satusehat')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Status SATUSEHAT klinik (global dan klinik)' })
  async clinicSatusehat(@ClinicId() clinicId: number) {
    return ApiResponse.success(await this.features.clinicSatusehat(clinicId));
  }

  @Put('features/clinic/satusehat')
  @Roles(UserRole.OWNER)
  @UseInterceptors(AuditInterceptor)
  @Audit('ClinicFeature', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Owner menyalakan/mematikan SATUSEHAT kliniknya' })
  async setClinicSatusehat(
    @ClinicId() clinicId: number,
    @Body() dto: SetEnabledDto,
    @CurrentUser() user: FeatureActor,
    @Req() req: { auditEntityLabel?: string },
  ) {
    req.auditEntityLabel = `SATUSEHAT klinik ${dto.enabled ? 'dinyalakan' : 'dimatikan'}`;
    return ApiResponse.success(
      await this.features.setClinicSatusehat(
        clinicId,
        dto.enabled,
        user.userId,
      ),
    );
  }
}
