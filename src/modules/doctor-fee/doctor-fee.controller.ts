import { Body, Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DoctorFeeService } from './doctor-fee.service';
import { JwtAuthGuard, RolesGuard, ClinicContextGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';
import { UpsertDoctorFeeConfigDto } from './dto/doctor-fee-config.dto';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('settings')
@Controller('settings/doctor-fee-configs')
@UseGuards(JwtAuthGuard, RolesGuard, ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@ApiBearerAuth('JWT-auth')
export class DoctorFeeController {
  constructor(private readonly service: DoctorFeeService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List doctor fee configs per tarif' })
  async findAll(@ClinicId() clinicId: number) {
    return this.service.listConfigs(clinicId);
  }

  @Post()
  @Audit('DoctorFeeConfig', AuditActionType.UPDATE)
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create or update fee config for a tarif' })
  async upsert(
    @Body() dto: UpsertDoctorFeeConfigDto,
    @CurrentUser() user: any,
    @ClinicId() clinicId: number,
  ) {
    return this.service.upsertConfig(dto, clinicId, user.userId);
  }
}
