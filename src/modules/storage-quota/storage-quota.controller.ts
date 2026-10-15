import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SkipSubscriptionCheck } from '../subscriptions/guards/subscription.guard';
import { UserRole } from '../../enums';
import { StorageQuotaService } from './storage-quota.service';
import { AdjustStorageDto, PurchaseStorageDto } from './dto/storage-addon.dto';

@ApiTags('storage')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
// Melihat & membeli storage harus tetap bisa saat langganan habis.
@SkipSubscriptionCheck()
@Controller('storage')
export class StorageQuotaController {
  constructor(private readonly quota: StorageQuotaService) {}

  @Get('usage')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Pemakaian & jatah storage klinik ini (bersama bila cabang multiklinik)' })
  async usage(@ClinicId() clinicId: number) {
    return { success: true, data: await this.quota.quotaForClinic(clinicId) };
  }

  @Get('pool')
  @Roles(UserRole.MULTI_CLINIC_OWNER)
  @ApiOperation({ summary: 'Owner multiklinik: jatah storage bersama semua cabang' })
  async pool(@CurrentUser() user: any) {
    return { success: true, data: await this.quota.quotaForOwner(user.userId) };
  }

  @Post('addons')
  @Roles(UserRole.OWNER, UserRole.MULTI_CLINIC_OWNER)
  @ApiOperation({
    summary:
      'Beli storage tambahan (Rp10.000/GB/bulan): langsung aktif, ditagih di perpanjangan berikutnya',
  })
  async purchase(@CurrentUser() user: any, @Body() dto: PurchaseStorageDto) {
    return { success: true, data: await this.quota.purchase(user, dto.gb) };
  }

  @Get('clinics')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Super Admin: pemakaian storage tiap klinik' })
  async clinics() {
    return { success: true, data: await this.quota.listClinics() };
  }

  @Get('owners/:ownerId')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Super Admin: jatah storage bersama satu owner multiklinik' })
  async owner(@Param('ownerId', ParseIntPipe) ownerId: number) {
    return { success: true, data: await this.quota.quotaForOwner(ownerId) };
  }

  @Post('addons/adjust')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Super Admin: tambah/kurangi storage tambahan secara manual' })
  async adjust(@CurrentUser() user: any, @Body() dto: AdjustStorageDto) {
    const data = await this.quota.adminAdjust(
      user,
      { clinicId: dto.clinicId, ownerId: dto.ownerId },
      dto.gb,
      dto.note,
    );
    return { success: true, data };
  }
}
