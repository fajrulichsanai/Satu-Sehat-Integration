import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';
import { ContentTemplatesService } from './content-templates.service';
import {
  CreateContentTemplateDto,
  UpdateContentTemplateDto,
} from './dto/content.dto';
import { RequireFeature } from '../features/require-feature.decorator';

/**
 * Treatment templates for Konten. Registered before ContentsController so
 * /contents/templates isn't taken for /contents/:id.
 */
@ApiTags('Contents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
@RequireFeature('konten')
@Controller('contents/templates')
export class ContentTemplatesController {
  constructor(private readonly service: ContentTemplatesService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar template tindakan' })
  async list(@ClinicId() clinicId: number) {
    return { success: true, data: await this.service.list(clinicId) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail template tindakan' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    return { success: true, data: await this.service.findOne(id, clinicId) };
  }

  @Post()
  @ApiOperation({ summary: 'Buat template tindakan' })
  async create(
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
    @Body() dto: CreateContentTemplateDto,
  ) {
    return {
      success: true,
      data: await this.service.create(clinicId, user.userId, dto),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Ubah template tindakan' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
    @Body() dto: UpdateContentTemplateDto,
  ) {
    return {
      success: true,
      data: await this.service.update(id, clinicId, user.userId, dto),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hapus template (kontennya tetap ada)' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    await this.service.remove(id, clinicId);
    return { success: true };
  }
}
