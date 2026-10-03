import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard, RolesGuard, ClinicContextGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';

@ApiTags('onboarding')
@ApiBearerAuth('JWT-auth')
@Controller('onboarding')
@UseGuards(JwtAuthGuard, RolesGuard, ClinicContextGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get('status')
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary:
      'Status kelengkapan onboarding klinik (info klinik, tarif, dokter) — Owner only',
  })
  async getStatus(@ClinicId() clinicId: number) {
    return this.onboardingService.getStatus(clinicId);
  }
}
