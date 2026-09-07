import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PatientConsentsService } from './patient-consents.service';
import { PatientConsentPdfService } from './patient-consent-pdf.service';
import {
  CreatePatientConsentDto,
  PatientConsentQueryDto,
  SignPatientConsentDto,
} from './dto/patient-consent.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('consents')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller('patient-consents')
export class PatientConsentsController {
  constructor(
    private readonly patientConsentsService: PatientConsentsService,
    private readonly patientConsentPdfService: PatientConsentPdfService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Daftar formulir persetujuan pasien' })
  async findAll(
    @Query() query: PatientConsentQueryDto,
    @ClinicId() clinicId: number,
  ) {
    const result = await this.patientConsentsService.findAll(clinicId, query);
    return { success: true, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail formulir persetujuan' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.patientConsentsService.findOne(id, clinicId);
    return { success: true, data };
  }

  @Post()
  @Audit('PatientConsent', AuditActionType.CREATE)
  @ApiOperation({
    summary: 'Buat formulir persetujuan baru dari template tindakan',
  })
  async create(
    @Body() dto: CreatePatientConsentDto,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
  ) {
    const data = await this.patientConsentsService.create(
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Patch(':id/sign')
  @Audit('PatientConsent', AuditActionType.UPDATE)
  @ApiOperation({
    summary: 'Tanda tangani formulir (role patient atau doctor)',
  })
  async sign(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: SignPatientConsentDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.patientConsentsService.sign(
      id,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Get(':id/pdf')
  @Audit('PatientConsent', AuditActionType.EXPORT)
  @ApiOperation({
    summary:
      'Unduh formulir persetujuan sebagai PDF (manual, tidak otomatis dikirim)',
  })
  async downloadPdf(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.patientConsentPdfService.generatePdf(
      id,
      clinicId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="consent-${id}.pdf"`,
    );
    res.end(pdfBuffer);
  }
}
