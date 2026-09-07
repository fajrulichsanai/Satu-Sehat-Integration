import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { ClinicsService } from './clinics.service';
import { JwtAuthGuard, RolesGuard, ClinicContextGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';
import { UpdateClinicDto, ClinicResponseDto } from './dto/clinic.dto';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';
import { clinicLogoUploadOptions } from './upload/clinic-logo.upload';

@ApiTags('settings')
@Controller('settings/clinic')
@UseGuards(JwtAuthGuard, RolesGuard, ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
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
  @Audit('Clinic', AuditActionType.UPDATE)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update clinic profile (Owner only)' })
  @ApiResponse({ status: 200, description: 'Clinic updated successfully' })
  @ApiResponse({ status: 404, description: 'Clinic not found' })
  async update(
    @Body() dto: UpdateClinicDto,
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
    @Req() req: any,
  ) {
    req.auditBefore = await this.clinicsService
      .findOne(clinicId)
      .catch(() => null);
    return this.clinicsService.update(clinicId, dto, user.userId);
  }

  @Post('logo')
  @Audit('Clinic', AuditActionType.UPDATE)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Upload logo/foto klinik ke object storage (Owner only)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Logo klinik berhasil diunggah' })
  @UseInterceptors(FileInterceptor('file', clinicLogoUploadOptions))
  async uploadLogo(
    @UploadedFile() file: Express.Multer.File,
    @ClinicId() clinicId: number,
    @Req() req: any,
  ) {
    req.auditBefore = await this.clinicsService
      .findOne(clinicId)
      .catch(() => null);
    return this.clinicsService.uploadLogo(clinicId, file);
  }
}

@ApiTags('settings')
@Controller('clinics')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT-auth')
export class ClinicsListController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all clinics (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Clinic list' })
  async findAll() {
    return this.clinicsService.findAllForSuperAdmin();
  }
}
