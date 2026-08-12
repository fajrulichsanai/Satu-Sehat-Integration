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
import { PatientsService } from './patients.service';
import {
  CreatePatientDto,
  PatientQueryDto,
  UpdatePatientDto,
} from './dto/patient.dto';
import { ClinicContextGuard } from '../auth/guards/clinic-context.guard';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Audit } from '../audit-log/decorators/audit.decorator';
import { AuditInterceptor } from '../audit-log/interceptors/audit.interceptor';
import { AuditActionType } from '../audit-log/entities/audit-log.entity';

@ApiTags('patients')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
@UseInterceptors(AuditInterceptor)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Get()
  @ApiOperation({ summary: 'List patients with pagination and search' })
  async findAll(@ClinicId() clinicId: number, @Query() query: PatientQueryDto) {
    const result = await this.patientsService.findAll(clinicId, query);
    return { success: true, ...result };
  }

  @Post()
  @Audit('Patient', AuditActionType.CREATE, { labelField: 'name' })
  @ApiOperation({ summary: 'Register new patient' })
  async create(@ClinicId() clinicId: number, @Body() dto: CreatePatientDto) {
    const patient = await this.patientsService.create(clinicId, dto);
    return {
      success: true,
      message: 'Pasien berhasil didaftarkan',
      data: patient,
    };
  }

  @Get('search-satusehat')
  @ApiOperation({ summary: 'Search patient by NIK via SATUSEHAT API' })
  async searchSatusehat(
    @Query('nik') nik: string,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.patientsService.searchSatusehat(nik, clinicId);
    return { success: true, data };
  }

  @Get('referral-summary')
  @ApiOperation({ summary: 'Get referral summary (by source and by referrer)' })
  async getReferralSummary(@ClinicId() clinicId: number) {
    const data = await this.patientsService.getReferralSummary(clinicId);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get patient detail' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    const patient = await this.patientsService.findOne(id, clinicId);
    return { success: true, data: patient };
  }

  @Put(':id')
  @Audit('Patient', AuditActionType.UPDATE, { labelField: 'name' })
  @ApiOperation({ summary: 'Update patient demographics' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdatePatientDto,
    @Req() req: any,
  ) {
    req.auditBefore = await this.patientsService.findOne(id, clinicId);
    const patient = await this.patientsService.update(id, clinicId, dto);
    return {
      success: true,
      message: 'Data pasien berhasil diperbarui',
      data: patient,
    };
  }

  @Get(':id/encounters')
  @ApiOperation({ summary: 'Get patient encounter history' })
  async findEncounters(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    const encounters = await this.patientsService.findEncounters(id, clinicId);
    return { success: true, data: encounters };
  }

  @Get(':id/treatment-plans')
  @ApiOperation({ summary: 'Get patient treatment plan progress' })
  async findTreatmentPlans(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.patientsService.findTreatmentPlans(id, clinicId);
    return { success: true, data };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Audit('Patient', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Delete a patient' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Req() req: any,
  ) {
    const existing = await this.patientsService.findOne(id, clinicId);
    req.auditBefore = existing;
    req.auditEntityLabel = existing?.name;
    await this.patientsService.remove(id, clinicId);
    return { success: true, message: 'Pasien berhasil dihapus' };
  }
}
