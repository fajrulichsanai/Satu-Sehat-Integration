import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicContent } from './entities/clinic-content.entity';
import { ContentTemplate } from './entities/content-template.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { ContentsService } from './contents.service';
import { ContentsController } from './contents.controller';
import { ContentTemplatesService } from './content-templates.service';
import { ContentTemplatesController } from './content-templates.controller';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClinicContent, ContentTemplate, Clinic]),
    StorageModule,
  ],
  // Templates first: /contents/templates must not match /contents/:id.
  controllers: [ContentTemplatesController, ContentsController],
  providers: [ContentsService, ContentTemplatesService],
  exports: [ContentsService],
})
export class ContentsModule {}
