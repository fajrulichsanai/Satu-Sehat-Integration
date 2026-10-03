import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SoapTemplatesService } from './soap-templates.service';
import {
  CreateSoapTemplateDto,
  SoapTemplateQueryDto,
  UpdateSoapTemplateDto,
} from './dto/soap-template.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('settings')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller('settings/soap-templates')
export class SoapTemplatesController {
  constructor(private readonly soapTemplatesService: SoapTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'List SOAP templates (shared + own personal)' })
  async findAll(
    @ClinicId() clinicId: number,
    @Query() query: SoapTemplateQueryDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.soapTemplatesService.findAll(clinicId, query, user);
    return { success: true, data };
  }

  @Post()
  @Audit('SoapTemplate', AuditActionType.CREATE, { labelField: 'name' })
  @ApiOperation({
    summary: 'Create SOAP template (owner can share, dokter personal only)',
  })
  async create(
    @ClinicId() clinicId: number,
    @Body() dto: CreateSoapTemplateDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.soapTemplatesService.create(clinicId, dto, user);
    return { success: true, data };
  }

  @Put(':id')
  @Audit('SoapTemplate', AuditActionType.UPDATE, { labelField: 'name' })
  @ApiOperation({ summary: 'Update SOAP template' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateSoapTemplateDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.soapTemplatesService.update(
      id,
      clinicId,
      dto,
      user,
    );
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Audit('SoapTemplate', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Delete SOAP template' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    req.auditBefore = { id };
    await this.soapTemplatesService.remove(id, clinicId, user);
    return { success: true };
  }
}
