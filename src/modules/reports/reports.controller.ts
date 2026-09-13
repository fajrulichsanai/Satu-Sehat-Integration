import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { InvestorReportPdfService } from './investor-report-pdf.service';
import { FinancialReportPdfService } from './financial-report-pdf.service';
import {
  DoctorFeeShareReportQueryDto,
  FinancialReportQueryDto,
  FinancialVisitDetailQueryDto,
  RetrySyncDto,
  SatusehatSyncReportQueryDto,
  VisitReportQueryDto,
} from './dto/report.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../enums/user-role.enum';

@ApiTags('reports')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly investorReportPdfService: InvestorReportPdfService,
    private readonly financialReportPdfService: FinancialReportPdfService,
  ) {}

  @Get('visits')
  @ApiOperation({ summary: 'Visit report (dokter sees own only)' })
  async getVisits(
    @ClinicId() clinicId: number,
    @Query() query: VisitReportQueryDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.reportsService.getVisitReport(
      clinicId,
      query,
      user,
    );
    return { ...result.data, meta: result.meta };
  }

  @Get('financial')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Financial report (owner only)' })
  async getFinancial(
    @ClinicId() clinicId: number,
    @Query() query: FinancialReportQueryDto,
  ) {
    const result = await this.reportsService.getFinancialReport(
      clinicId,
      query,
    );
    return { success: true, data: result.data };
  }

  @Get('financial-pro')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary:
      'Financial report Pro — laba kotor, tren bulanan, laba per dokter, heatmap kunjungan, laporan stok (owner only)',
  })
  async getFinancialPro(
    @ClinicId() clinicId: number,
    @Query() query: FinancialReportQueryDto,
  ) {
    const result = await this.reportsService.getFinancialReportPro(
      clinicId,
      query,
    );
    return { success: true, data: result.data };
  }

  @Get('financial-pro/pdf')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary:
      'Download laporan keuangan siap print/kirim ke akuntan sebagai PDF (owner only)',
  })
  async downloadFinancialProPdf(
    @ClinicId() clinicId: number,
    @Query() query: FinancialReportQueryDto,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.financialReportPdfService.generate(
      clinicId,
      query,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="laporan-keuangan-${query.dateFrom}_${query.dateTo}.pdf"`,
    );
    res.end(pdfBuffer);
  }

  @Get('financial-pro/patient-origin-map')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Sebaran asal pasien per kecamatan untuk bubble map (owner only)',
  })
  async getPatientOriginMap(@ClinicId() clinicId: number) {
    const result = await this.reportsService.getPatientOriginMap(clinicId);
    return { success: true, data: result.data };
  }

  @Get('financial-pro/patient-origin-kelurahan')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Sebaran asal pasien per kelurahan, breakdown tabel (owner only)',
  })
  async getPatientOriginByKelurahan(@ClinicId() clinicId: number) {
    const result =
      await this.reportsService.getPatientOriginByKelurahan(clinicId);
    return { success: true, data: result.data };
  }

  @Get('investor/pdf')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary:
      'Download investor-grade financial & business report as PDF (owner only, trailing 12 months)',
  })
  async downloadInvestorReport(
    @ClinicId() clinicId: number,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.investorReportPdfService.generate(clinicId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="laporan-investor-${clinicId}.pdf"`,
    );
    res.end(pdfBuffer);
  }

  @Get('financial/visit-detail')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({
    summary: 'Financial report - patient visit detail (owner only)',
  })
  async getFinancialVisitDetail(
    @ClinicId() clinicId: number,
    @Query() query: FinancialVisitDetailQueryDto,
  ) {
    const result = await this.reportsService.getFinancialVisitDetail(
      clinicId,
      query,
    );
    return result.data;
  }

  @Get('satusehat-sync')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'SATUSEHAT sync status report (owner only)' })
  async getSatusehatSync(
    @ClinicId() clinicId: number,
    @Query() query: SatusehatSyncReportQueryDto,
  ) {
    const result = await this.reportsService.getSatusehatSyncReport(
      clinicId,
      query,
    );
    return { success: true, data: result.data };
  }

  @Get('doctor-fee-share')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DOKTER)
  @ApiOperation({
    summary:
      'Monthly doctor fee share report (dokter sees only their own share)',
  })
  async getDoctorFeeShare(
    @ClinicId() clinicId: number,
    @Query() query: DoctorFeeShareReportQueryDto,
    @CurrentUser() user: any,
  ) {
    if (user.role === UserRole.DOKTER) {
      // A dokter must never see a colleague's fee breakdown. Force the
      // filter to their own linked practitioner row rather than trusting a
      // query param — there isn't one exposed for this on purpose. If the
      // account has no linked practitioner yet (role just assigned, sync
      // pending), return an empty report instead of accidentally falling
      // through to the unfiltered (all-practitioners) query.
      if (!user.practitionerId) {
        return { success: true, data: [] };
      }
      return this.reportsService.getDoctorFeeShareReport(
        clinicId,
        query,
        user.practitionerId,
      );
    }
    return this.reportsService.getDoctorFeeShareReport(clinicId, query);
  }

  @Post('satusehat-sync/retry')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Retry failed SATUSEHAT syncs' })
  async retrySync(@ClinicId() clinicId: number, @Body() dto: RetrySyncDto) {
    const data = await this.reportsService.retrySync(clinicId, dto);
    return { success: true, data };
  }
}
