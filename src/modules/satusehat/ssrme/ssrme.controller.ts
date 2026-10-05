import {
  Body,
  Controller,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { ClinicContextGuard } from '../../auth/guards/clinic-context.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ClinicId } from '../../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { UserRole } from '../../../enums/user-role.enum';
import { ApiResponse } from '../../../common/response/api-response';
import { AuditInterceptor } from '../../audit-log/interceptors/audit.interceptor';
import { Audit } from '../../audit-log/decorators/audit.decorator';
import { AuditActionType } from '../../audit-log/entities/audit-log.entity';
import { SsrmeService } from './ssrme.service';

export class SsrmeConsentDto {
  /** Kondisi gawat darurat: bypass persetujuan pasien (form darurat SSRME) */
  @IsOptional()
  @IsBoolean()
  emergency?: boolean;
}

/** Tenaga kesehatan klinik; admin/perawat boleh memproses consent pasien. */
const CLINICIANS = [
  UserRole.OWNER,
  UserRole.MULTI_CLINIC_OWNER,
  UserRole.DOKTER,
];

@ApiTags('satusehat')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
@Controller('satusehat/ssrme/encounters/:encounterId')
export class SsrmeController {
  constructor(private readonly ssrme: SsrmeService) {}

  @Post('consent')
  @HttpCode(200)
  @Roles(...CLINICIANS, UserRole.ADMIN)
  @Audit('SSRME Consent', AuditActionType.VIEW)
  @ApiOperation({ summary: 'SSRME: buat link persetujuan pasien (CHLink)' })
  async consent(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: { userId: number; role: UserRole },
    @Body() dto: SsrmeConsentDto,
  ) {
    return ApiResponse.success(
      await this.ssrme.createConsentLink(
        clinicId,
        encounterId,
        user,
        dto.emergency === true,
      ),
    );
  }

  @Post('open')
  @HttpCode(200)
  @Roles(...CLINICIANS)
  @Audit('SSRME RME Nasional', AuditActionType.VIEW)
  @ApiOperation({ summary: 'SSRME: buka RME Nasional pasien (SHLink)' })
  async open(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: { userId: number; role: UserRole },
  ) {
    return ApiResponse.success(
      await this.ssrme.openRecord(clinicId, encounterId, user),
    );
  }
}
