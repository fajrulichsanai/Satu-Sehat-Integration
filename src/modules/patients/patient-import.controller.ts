import {
  BadRequestException,
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../enums';
import { PatientImportService } from './patient-import.service';
import { patientImportUploadOptions } from './upload/patient-import.upload';

/**
 * Super Admin-only clinic data migration tool. Deliberately not nested under
 * the regular `/patients` controller: that one sits behind ClinicContextGuard,
 * which resolves a Super Admin's clinicId to null (they don't belong to any
 * single clinic) — the target clinic here must instead be chosen explicitly
 * from the request, since Super Admin acts on behalf of a clinic, not as one.
 */
@ApiTags('super-admin')
@ApiBearerAuth('JWT-auth')
@Controller('super-admin/patients')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class PatientImportController {
  constructor(private readonly patientImportService: PatientImportService) {}

  @Get('import-template')
  @ApiOperation({ summary: 'Download the patient migration spreadsheet template (Super Admin only)' })
  async downloadTemplate(@Res() res: Response) {
    const buffer = this.patientImportService.generateTemplateBuffer();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="template-migrasi-pasien.xlsx"',
    });
    res.send(buffer);
  }

  @Post('import')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Bulk-import patients from a clinic spreadsheet (Super Admin only)' })
  @UseInterceptors(FileInterceptor('file', patientImportUploadOptions))
  async importPatients(
    @UploadedFile() file: Express.Multer.File,
    @Body('clinicId', ParseIntPipe) clinicId: number,
  ) {
    if (!file) {
      throw new BadRequestException('File spreadsheet wajib diunggah');
    }

    const rows = this.patientImportService.parseFile(file.buffer);
    if (rows.length === 0) {
      throw new BadRequestException(
        'File tidak berisi data — pastikan menggunakan template yang disediakan',
      );
    }

    const summary = await this.patientImportService.importRows(clinicId, rows);
    return { success: true, data: summary };
  }
}
