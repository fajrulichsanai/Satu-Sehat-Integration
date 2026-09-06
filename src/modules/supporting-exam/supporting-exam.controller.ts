import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
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
import { SupportingExamService } from './supporting-exam.service';
import { CreateSupportingExamImageDto } from './dto/supporting-exam-image.dto';
import { supportingExamImageUploadOptions } from './upload/supporting-exam-image.storage';
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
@Controller('encounters/:encounterId/supporting-exam-images')
export class SupportingExamController {
  constructor(private readonly supportingExamService: SupportingExamService) {}

  @Get()
  @ApiOperation({
    summary: 'List supporting exam images (photo/rontgen) for an encounter',
  })
  async list(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
  ) {
    const data = await this.supportingExamService.listByEncounter(
      encounterId,
      clinicId,
    );
    return { success: true, data };
  }

  @Post()
  @UseInterceptors(FileInterceptor('image', supportingExamImageUploadOptions))
  @Audit('MedicalRecord', AuditActionType.CREATE)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary:
      'Upload a supporting exam image (photo or rontgen) for an encounter',
  })
  async create(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @ClinicId() clinicId: number,
    @Body() dto: CreateSupportingExamImageDto,
    @CurrentUser() user: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const data = await this.supportingExamService.create(
      encounterId,
      clinicId,
      dto,
      file,
      user.userId,
    );
    return { success: true, data };
  }

  @Delete(':imageId')
  @Audit('MedicalRecord', AuditActionType.DELETE)
  @ApiOperation({ summary: 'Delete a supporting exam image' })
  async remove(
    @Param('encounterId', ParseIntPipe) encounterId: number,
    @Param('imageId', ParseIntPipe) imageId: number,
    @ClinicId() clinicId: number,
  ) {
    await this.supportingExamService.remove(encounterId, clinicId, imageId);
    return { success: true };
  }
}
