import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
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
import { RequireFeature } from '../../features/require-feature.decorator';
import { KycService } from './kyc.service';

export class KycUrlDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  agentName?: string;

  @IsOptional()
  @Matches(/^\d{16}$/, { message: 'NIK petugas harus 16 digit' })
  agentNik?: string;
}

export class KycChallengeDto {
  @IsUUID()
  sessionId: string;

  @IsOptional()
  @IsInt()
  patientId?: number;

  @IsOptional()
  @Matches(/^\d{16}$/, { message: 'NIK pasien harus 16 digit' })
  nik?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

/** Petugas pendaftaran/nakes yang boleh memverifikasi profil pasien. */
const KYC_ROLES = [
  UserRole.OWNER,
  UserRole.MULTI_CLINIC_OWNER,
  UserRole.ADMIN,
  UserRole.DOKTER,
  UserRole.PERAWAT,
];

@ApiTags('satusehat')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard, RolesGuard)
@UseInterceptors(AuditInterceptor)
@RequireFeature('satusehat')
@Roles(...KYC_ROLES)
@Controller('satusehat/kyc')
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get('agent')
  @ApiOperation({ summary: 'KYC: data petugas default (nakes akun login)' })
  async agent(
    @ClinicId() clinicId: number,
    @CurrentUser() user: { userId: number },
  ) {
    return ApiResponse.success(
      await this.kyc.agentDefaults(clinicId, user.userId),
    );
  }

  @Post('url')
  @HttpCode(200)
  @Audit('KYC Generate URL', AuditActionType.VIEW)
  @ApiOperation({ summary: 'KYC: buat URL iFrame verifikasi SATUSEHAT Mobile' })
  async url(
    @ClinicId() clinicId: number,
    @CurrentUser() user: { userId: number },
    @Body() dto: KycUrlDto,
  ) {
    return ApiResponse.success(
      await this.kyc.generateUrl(clinicId, user.userId, dto),
    );
  }

  @Post('challenge-code')
  @HttpCode(200)
  @Audit('KYC Challenge Code', AuditActionType.VIEW)
  @ApiOperation({ summary: 'KYC: kode verifikasi pasien per NIK' })
  async challenge(
    @ClinicId() clinicId: number,
    @CurrentUser() user: { userId: number },
    @Body() dto: KycChallengeDto,
  ) {
    return ApiResponse.success(
      await this.kyc.challengeCode(clinicId, user.userId, dto),
    );
  }

  @Delete('sessions/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'KYC: akhiri sesi verifikasi' })
  end(
    @ClinicId() clinicId: number,
    @CurrentUser() user: { userId: number },
    @Param('id') id: string,
  ) {
    this.kyc.endSession(clinicId, user.userId, id);
    return ApiResponse.success({ ended: true });
  }
}
