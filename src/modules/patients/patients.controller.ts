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
  UseGuards,
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

@ApiTags('patients')
@ApiBearerAuth('JWT-auth')
@UseGuards(ClinicContextGuard)
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
  @ApiOperation({ summary: 'Update patient demographics' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @Body() dto: UpdatePatientDto,
  ) {
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

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a patient' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    await this.patientsService.remove(id, clinicId);
    return { success: true, message: 'Pasien berhasil dihapus' };
  }
}
