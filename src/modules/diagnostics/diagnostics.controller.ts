import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';
import { DiagnosticsService } from './diagnostics.service';
import {
  CreateLabOrderDto,
  CreateRadiologyOrderDto,
  SaveLabResultsDto,
  UpdateLabOrderDto,
  UpdateRadiologyOrderDto,
} from './dto/diagnostics.dto';

/** Pemeriksaan penunjang: laboratorium & radiologi per kunjungan. */
@ApiTags('encounters')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller('encounters/:encounterId')
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  @Get('lab-orders')
  @Audit('LabOrder', AuditActionType.VIEW)
  @ApiOperation({ summary: 'Daftar permintaan & hasil lab kunjungan' })
  async listLab(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    return {
      success: true,
      data: await this.diagnostics.listLab(encounterId, clinicId),
    };
  }

  @Post('lab-orders')
  @Audit('LabOrder', AuditActionType.CREATE)
  @ApiOperation({ summary: 'Buat permintaan pemeriksaan lab' })
  async createLab(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: CreateLabOrderDto,
    @CurrentUser() user: { userId: number },
  ) {
    return {
      success: true,
      data: await this.diagnostics.createLab(
        encounterId,
        clinicId,
        dto,
        user.userId,
      ),
    };
  }

  @Patch('lab-orders/:id')
  @Audit('LabOrder', AuditActionType.UPDATE)
  @ApiOperation({
    summary: 'Catat spesimen / kesimpulan / status permintaan lab',
  })
  async updateLab(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateLabOrderDto,
    @CurrentUser() user: { userId: number },
  ) {
    return {
      success: true,
      data: await this.diagnostics.updateLab(
        encounterId,
        clinicId,
        id,
        dto,
        user.userId,
      ),
    };
  }

  @Put('lab-orders/:id/results')
  @Audit('LabOrder', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Simpan hasil pemeriksaan lab' })
  async saveResults(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: SaveLabResultsDto,
    @CurrentUser() user: { userId: number },
  ) {
    return {
      success: true,
      data: await this.diagnostics.saveLabResults(
        encounterId,
        clinicId,
        id,
        dto,
        user.userId,
      ),
    };
  }

  @Delete('lab-orders/:id')
  @HttpCode(200)
  @Audit('LabOrder', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Hapus permintaan lab' })
  async removeLab(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    await this.diagnostics.removeLab(encounterId, clinicId, id);
    return { success: true, data: null };
  }

  @Get('radiology-orders')
  @Audit('RadiologyOrder', AuditActionType.VIEW)
  @ApiOperation({ summary: 'Daftar permintaan & hasil radiologi kunjungan' })
  async listRadiology(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    return {
      success: true,
      data: await this.diagnostics.listRadiology(encounterId, clinicId),
    };
  }

  @Post('radiology-orders')
  @Audit('RadiologyOrder', AuditActionType.CREATE)
  @ApiOperation({ summary: 'Buat permintaan pemeriksaan radiologi' })
  async createRadiology(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: CreateRadiologyOrderDto,
    @CurrentUser() user: { userId: number },
  ) {
    return {
      success: true,
      data: await this.diagnostics.createRadiology(
        encounterId,
        clinicId,
        dto,
        user.userId,
      ),
    };
  }

  @Patch('radiology-orders/:id')
  @Audit('RadiologyOrder', AuditActionType.UPDATE)
  @ApiOperation({ summary: 'Simpan bacaan/kesimpulan radiologi' })
  async updateRadiology(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdateRadiologyOrderDto,
    @CurrentUser() user: { userId: number },
  ) {
    return {
      success: true,
      data: await this.diagnostics.updateRadiology(
        encounterId,
        clinicId,
        id,
        dto,
        user.userId,
      ),
    };
  }

  @Delete('radiology-orders/:id')
  @HttpCode(200)
  @Audit('RadiologyOrder', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Hapus permintaan radiologi' })
  async removeRadiology(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    await this.diagnostics.removeRadiology(encounterId, clinicId, id);
    return { success: true, data: null };
  }
}
