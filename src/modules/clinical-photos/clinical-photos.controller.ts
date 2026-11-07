import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ClinicalPhotosService } from './clinical-photos.service';
import {
  SetPhotoConsentDto,
  UploadPatientPhotoDto,
} from './dto/patient-photo.dto';
import { patientPhotoUploadOptions } from './upload/patient-photo.storage';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('Clinical Photos')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller()
export class ClinicalPhotosController {
  constructor(private readonly service: ClinicalPhotosService) {}

  @Audit('PatientPhoto', AuditActionType.VIEW)
  @Get('encounters/:encounterId/photos')
  @ApiOperation({ summary: 'Daftar foto klinis kontrol ini' })
  async listByEncounter(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.service.listByEncounter(encounterId, clinicId);
    return { success: true, data };
  }

  @Post('encounters/:encounterId/photos')
  @UseInterceptors(FileInterceptor('photo', patientPhotoUploadOptions))
  @Audit('MedicalRecord', AuditActionType.CREATE)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Unggah foto klinis untuk kontrol ini' })
  async upload(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: UploadPatientPhotoDto,
    @CurrentUser() user: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const data = await this.service.upload(
      encounterId,
      clinicId,
      user.userId,
      dto.templateId,
      dto.originalSizeBytes,
      file,
    );
    return { success: true, data };
  }

  @Audit('PatientPhoto', AuditActionType.VIEW)
  @Get('encounters/:encounterId/photos/:photoId/file')
  @ApiOperation({ summary: 'Streaming file foto klinis (terautentikasi)' })
  async getFile(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('photoId', ParseIntPipe) photoId: number,
    @ClinicId() clinicId: number,
    @Res() res: Response,
  ) {
    const { absolutePath } = await this.service.getFilePath(
      encounterId,
      clinicId,
      photoId,
    );
    res.sendFile(absolutePath);
  }

  @Delete('encounters/:encounterId/photos/:photoId')
  @Audit('MedicalRecord', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Hapus foto klinis' })
  async remove(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('photoId', ParseIntPipe) photoId: number,
    @ClinicId() clinicId: number,
  ) {
    await this.service.remove(encounterId, clinicId, photoId);
    return { success: true };
  }

  @Audit('PatientPhoto', AuditActionType.VIEW)
  @Get('patients/:patientId/photos')
  @ApiOperation({ summary: 'Galeri foto klinis pasien, tersusun per folder' })
  async listForPatient(
    @Param('patientId', ParseIntPipe) patientId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.service.listForPatient(patientId, clinicId);
    return { success: true, data };
  }

  @Patch('patients/:patientId/photo-consent')
  @Audit('Patient', AuditActionType.UPDATE)
  @ApiOperation({
    summary: 'Izin pakai foto pasien ini sebagai konten promosi',
  })
  async setConsent(
    @Param('patientId', ParseIntPipe) patientId: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
    @Body() dto: SetPhotoConsentDto,
  ) {
    const data = await this.service.setConsent(
      patientId,
      clinicId,
      user.userId,
      dto.consent,
    );
    return {
      success: true,
      data: { photoConsentMarketing: data.photoConsentMarketing },
    };
  }
}
