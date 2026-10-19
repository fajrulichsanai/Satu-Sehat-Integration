import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicContent } from './entities/clinic-content.entity';
import { ContentTemplate } from './entities/content-template.entity';
import { ContentPhoto } from './entities/content-photo.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { ContentsService } from './contents.service';
import { ContentsController } from './contents.controller';
import { ContentTemplatesService } from './content-templates.service';
import { ContentTemplatesController } from './content-templates.controller';
import { StorageModule } from '../../common/storage/storage.module';
import { ClinicalPhotosModule } from '../clinical-photos/clinical-photos.module';
import { SupportingExamModule } from '../supporting-exam/supporting-exam.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClinicContent, ContentTemplate, ContentPhoto, Clinic]),
    StorageModule,
    ClinicalPhotosModule,
    SupportingExamModule,
  ],
  // Templates first: /contents/templates must not match /contents/:id.
  controllers: [ContentTemplatesController, ContentsController],
  providers: [ContentsService, ContentTemplatesService],
  exports: [ContentsService],
})
export class ContentsModule {}
