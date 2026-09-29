import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConsentTemplatesService } from './consent-templates.service';
import { UpsertConsentTemplateDto } from './dto/consent-template.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../enums';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('consents')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller('consent-templates')
export class ConsentTemplatesController {
  constructor(
    private readonly consentTemplatesService: ConsentTemplatesService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List template informed consent per tindakan' })
  async findAll(@ClinicId() clinicId: number) {
    const data = await this.consentTemplatesService.findAll(clinicId);
    return { success: true, data };
  }

  @Put(':tarifId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @Audit('ConsentTemplate', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Atur/ubah template consent untuk sebuah tarif' })
  async upsert(
    @Param('tarifId', ParseIntPipe) tarifId: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpsertConsentTemplateDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.consentTemplatesService.upsert(
      clinicId,
      tarifId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Delete(':tarifId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @Audit('ConsentTemplate', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Hapus template consent untuk sebuah tarif' })
  async remove(
    @Param('tarifId', ParseIntPipe) tarifId: number,
    @ClinicId() clinicId: number,
  ) {
    await this.consentTemplatesService.remove(clinicId, tarifId);
    return { success: true };
  }
}
