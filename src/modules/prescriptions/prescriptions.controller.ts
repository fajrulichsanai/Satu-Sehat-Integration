import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionPdfService } from './prescription-pdf.service';
import {
  AdministerPrescriptionDto,
  CreatePrescriptionItemDto,
  DispensePrescriptionDto,
  SavePrescriptionReviewDto,
  SavePrescriptionSignatureDto,
  SetPrescriptionCodingDto,
} from './dto/prescription-item.dto';
import { PRESCRIPTION_REVIEW_GROUPS } from './prescription-review.questions';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('encounters')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller('encounters/:encounterId/prescriptions')
export class PrescriptionsController {
  constructor(
    private readonly prescriptionsService: PrescriptionsService,
    private readonly prescriptionPdfService: PrescriptionPdfService,
  ) {}

  @Audit('Prescription', AuditActionType.VIEW)
  @Get()
  @ApiOperation({ summary: 'List prescription items for an encounter' })
  async findAll(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.prescriptionsService.listByEncounter(
      encounterId,
      clinicId,
    );
    return { success: true, data };
  }

  @Audit('Prescription', AuditActionType.VIEW)
  @Get('pdf')
  @Audit('Prescription', AuditActionType.EXPORT)
  @ApiOperation({ summary: 'Download prescription sheet as PDF' })
  async downloadPdf(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.prescriptionPdfService.generatePrescriptionPdf(
      encounterId,
      clinicId,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="resep-${encounterId}.pdf"`,
    );
    res.end(pdfBuffer);
  }

  @Get('signature')
  @ApiOperation({ summary: 'Tanda tangan dokter pada resep' })
  async getSignature(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.prescriptionsService.getSignature(
      encounterId,
      clinicId,
    );
    return { success: true, data };
  }

  @Put('signature')
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Simpan tanda tangan dokter pada resep' })
  async saveSignature(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: SavePrescriptionSignatureDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.prescriptionsService.saveSignature(
      encounterId,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Delete('signature')
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Hapus tanda tangan dokter pada resep' })
  async removeSignature(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    await this.prescriptionsService.removeSignature(encounterId, clinicId);
    return { success: true, data: null };
  }

  @Post()
  @Audit('MedicalRecord', AuditActionType.CREATE)
  @ApiOperation({ summary: 'Add a prescription item to an encounter' })
  async create(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: CreatePrescriptionItemDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.prescriptionsService.create(
      encounterId,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Put(':itemId/coding')
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({
    summary: 'Pasang kode KFA atau ubah obat menjadi racikan (untuk SATUSEHAT)',
  })
  async setCoding(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @ClinicId() clinicId: number,
    @Body() dto: SetPrescriptionCodingDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.prescriptionsService.setCoding(
      encounterId,
      clinicId,
      itemId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Post(':itemId/dispense')
  @HttpCode(200)
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({
    summary: 'Catat obat diserahkan ke pasien (pengeluaran obat)',
  })
  async dispense(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @ClinicId() clinicId: number,
    @Body() dto: DispensePrescriptionDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.prescriptionsService.dispense(
      encounterId,
      clinicId,
      itemId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Delete(':itemId/dispense')
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Batalkan catatan pengeluaran obat' })
  async undoDispense(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
  ) {
    const data = await this.prescriptionsService.undoDispense(
      encounterId,
      clinicId,
      itemId,
      user.userId,
    );
    return { success: true, data };
  }

  @Post(':itemId/administer')
  @HttpCode(200)
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Catat obat diberikan langsung di klinik' })
  async administer(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @ClinicId() clinicId: number,
    @Body() dto: AdministerPrescriptionDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.prescriptionsService.administer(
      encounterId,
      clinicId,
      itemId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Delete(':itemId/administer')
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Batalkan catatan pemberian obat' })
  async undoAdminister(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
  ) {
    const data = await this.prescriptionsService.undoAdminister(
      encounterId,
      clinicId,
      itemId,
      user.userId,
    );
    return { success: true, data };
  }

  @Get('review')
  @Audit('Prescription', AuditActionType.VIEW)
  @ApiOperation({ summary: 'Pengkajian resep kunjungan (Q0007)' })
  async getReview(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    return {
      success: true,
      data: {
        review: await this.prescriptionsService.getReview(
          encounterId,
          clinicId,
        ),
        questions: PRESCRIPTION_REVIEW_GROUPS,
      },
    };
  }

  @Put('review')
  @Audit('MedicalRecord', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Simpan pengkajian resep' })
  async saveReview(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: SavePrescriptionReviewDto,
    @CurrentUser() user: any,
  ) {
    const data = await this.prescriptionsService.saveReview(
      encounterId,
      clinicId,
      dto,
      user.userId,
    );
    return { success: true, data };
  }

  @Delete(':itemId')
  @Audit('MedicalRecord', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Remove a prescription item from an encounter' })
  async remove(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @ClinicId() clinicId: number,
  ) {
    await this.prescriptionsService.remove(encounterId, clinicId, itemId);
    return { success: true };
  }
}
