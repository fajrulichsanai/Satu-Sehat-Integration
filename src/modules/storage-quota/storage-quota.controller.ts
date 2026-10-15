import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { SkipSubscriptionCheck } from '../subscriptions/guards/subscription.guard';
import { UserRole } from '../../enums';
import { StorageQuotaService } from './storage-quota.service';

@ApiTags('storage')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@SkipSubscriptionCheck()
@Controller('storage')
export class StorageQuotaController {
  constructor(private readonly quota: StorageQuotaService) {}

  @Get('usage')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Pemakaian & jatah storage klinik ini (bersama bila cabang multiklinik)',
  })
  async usage(@ClinicId() clinicId: number) {
    return { success: true, data: await this.quota.quotaForClinic(clinicId) };
  }

  @Get('clinics')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Super Admin: pemakaian storage tiap klinik' })
  async clinics() {
    return { success: true, data: await this.quota.listClinics() };
  }
}
