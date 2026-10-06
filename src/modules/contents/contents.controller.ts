import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ClinicId } from '../auth/decorators/clinic-id.decorator';
import { UserRole } from '../../enums';
import { ContentsService, type ContentPhoto } from './contents.service';
import {
  ContentQueryDto,
  CreateContentDto,
  UpdateContentDto,
} from './dto/content.dto';
import { contentImageUploadOptions } from './upload/content-image.upload';
import { RequireFeature } from '../features/require-feature.decorator';

const PHOTOS: ContentPhoto[] = ['before', 'after', 'rendered'];

const sendImage = (
  res: Response,
  file: { buffer: Buffer; contentType: string },
) => {
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.send(file.buffer);
};

/**
 * Konten: before–after stories the clinic makes for social media and its
 * website. Owners and admins manage them; published ones appear on the
 * clinic website through the public API.
 */
@ApiTags('Contents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER, UserRole.ADMIN)
@RequireFeature('konten')
@Controller('contents')
export class ContentsController {
  constructor(private readonly service: ContentsService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar konten klinik' })
  async list(@ClinicId() clinicId: number, @Query() query: ContentQueryDto) {
    return { success: true, data: await this.service.list(clinicId, query) };
  }

  @Post('images')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Unggah foto untuk konten (sebelum/sesudah)' })
  @UseInterceptors(FileInterceptor('file', contentImageUploadOptions))
  async uploadImage(
    @ClinicId() clinicId: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return {
      success: true,
      data: await this.service.uploadImage(clinicId, file),
    };
  }

  @Get('logo')
  @ApiOperation({ summary: 'Logo klinik untuk digambar di story' })
  async logo(@ClinicId() clinicId: number, @Res() res: Response) {
    sendImage(res, await this.service.readLogo(clinicId));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail konten' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    return { success: true, data: await this.service.findOne(id, clinicId) };
  }

  @Get(':id/photos/:which')
  @ApiOperation({ summary: 'Foto konten (before, after, rendered)' })
  async photo(
    @Param('id', ParseIntPipe) id: number,
    @Param('which') which: string,
    @ClinicId() clinicId: number,
    @Res() res: Response,
  ) {
    const kind = PHOTOS.includes(which as ContentPhoto)
      ? (which as ContentPhoto)
      : 'rendered';
    sendImage(res, await this.service.readPhoto(id, clinicId, kind));
  }

  @Post()
  @ApiOperation({ summary: 'Simpan konten baru sebagai draft' })
  async create(
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
    @Body() dto: CreateContentDto,
  ) {
    return {
      success: true,
      data: await this.service.create(clinicId, user.userId, dto),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Simpan perubahan konten' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
    @Body() dto: UpdateContentDto,
  ) {
    return {
      success: true,
      data: await this.service.update(id, clinicId, user.userId, dto),
    };
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Publikasikan konten (unggah gambar story final)' })
  @UseInterceptors(FileInterceptor('file', contentImageUploadOptions))
  async publish(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return {
      success: true,
      data: await this.service.publish(id, clinicId, user.userId, file),
    };
  }

  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tarik konten dari website (kembali ke draft)' })
  async unpublish(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
    @CurrentUser() user: any,
  ) {
    return {
      success: true,
      data: await this.service.unpublish(id, clinicId, user.userId),
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hapus konten' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @ClinicId() clinicId: number,
  ) {
    await this.service.remove(id, clinicId);
    return { success: true };
  }
}
