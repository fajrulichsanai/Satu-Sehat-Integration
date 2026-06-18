import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ClinicsService } from './clinics.service';
import { JwtAuthGuard, RolesGuard, ClinicContextGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';
import {
  UpdateClinicDto,
  ClinicResponseDto,
} from './dto/clinic.dto';

@ApiTags('settings')
@Controller('settings/clinic')
@UseGuards(JwtAuthGuard, RolesGuard, ClinicContextGuard)
@ApiBearerAuth('JWT-auth')
export class ClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get clinic settings' })
  @ApiResponse({
    status: 200,
    description: 'Clinic settings',
    type: ClinicResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async findOne(@ClinicId() clinicId: number) {
    return this.clinicsService.findOne(clinicId);
  }

  @Put()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update clinic profile (Owner only)' })
  @ApiResponse({ status: 200, description: 'Clinic updated successfully' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async update(
    @Body() dto: UpdateClinicDto,
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
  ) {
    return this.clinicsService.update(clinicId, dto, user.userId);
  }

}
