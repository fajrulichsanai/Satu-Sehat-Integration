import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';
import { ClinicalPhotosService } from './clinical-photos.service';
import {
  CreatePhotoTemplateDto,
  CreatePhotoTemplateGroupDto,
  UpdatePhotoTemplateDto,
  UpdatePhotoTemplateGroupDto,
} from './dto/photo-template-group.dto';

/** Folder & template foto klinis — lihat PRD "Template Foto Pasien & Manajemen Konten". */
@ApiTags('Clinical Photos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('photo-template-groups')
export class PhotoTemplateGroupsController {
  constructor(private readonly service: ClinicalPhotosService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar folder foto klinis (bawaan + milik klinik)' })
  async list(
    @ClinicId() clinicId: number,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return {
      success: true,
      data: await this.service.listGroups(clinicId, {
        activeOnly: activeOnly !== 'false',
      }),
    };
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAJER_CABANG, UserRole.ADMIN)
  @ApiOperation({ summary: 'Buat folder foto klinis baru milik klinik ini' })
  async create(
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
    @Body() dto: CreatePhotoTemplateGroupDto,
  ) {
    return {
      success: true,
      data: await this.service.createGroup(clinicId, user.userId, dto),
    };
  }

  @Patch(':groupId')
  @Roles(UserRole.OWNER, UserRole.MANAJER_CABANG, UserRole.ADMIN)
  @ApiOperation({
    summary:
      'Ubah folder (milik klinik: nama/urutan/aktif; bawaan sistem: hanya aktif/nonaktif)',
  })
  async update(
    @Param('groupId', ParseIntPipe) groupId: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
    @Body() dto: UpdatePhotoTemplateGroupDto,
  ) {
    return {
      success: true,
      data: await this.service.updateGroup(clinicId, user.userId, groupId, dto),
    };
  }

  @Post(':groupId/templates')
  @Roles(UserRole.OWNER, UserRole.MANAJER_CABANG, UserRole.ADMIN)
  @ApiOperation({ summary: 'Tambah slot foto ke folder milik klinik ini' })
  async createTemplate(
    @Param('groupId', ParseIntPipe) groupId: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
    @Body() dto: CreatePhotoTemplateDto,
  ) {
    return {
      success: true,
      data: await this.service.createTemplate(
        clinicId,
        user.userId,
        groupId,
        dto,
      ),
    };
  }

  @Patch('templates/:templateId')
  @Roles(UserRole.OWNER, UserRole.MANAJER_CABANG, UserRole.ADMIN)
  @ApiOperation({ summary: 'Ubah slot foto' })
  async updateTemplate(
    @Param('templateId', ParseIntPipe) templateId: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
    @Body() dto: UpdatePhotoTemplateDto,
  ) {
    return {
      success: true,
      data: await this.service.updateTemplate(
        clinicId,
        user.userId,
        templateId,
        dto,
      ),
    };
  }
}
