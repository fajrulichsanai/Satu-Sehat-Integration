import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhotoTemplateGroup } from './entities/photo-template-group.entity';
import { PhotoTemplate } from './entities/photo-template.entity';
import { PatientPhoto } from './entities/patient-photo.entity';
import { ClinicDisabledPhotoGroup } from './entities/clinic-disabled-photo-group.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { ClinicalPhotosService } from './clinical-photos.service';
import { ClinicalPhotosController } from './clinical-photos.controller';
import { PhotoTemplateGroupsController } from './photo-template-groups.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PhotoTemplateGroup,
      PhotoTemplate,
      PatientPhoto,
      ClinicDisabledPhotoGroup,
      Patient,
      Encounter,
    ]),
    AuditLogModule,
  ],
  controllers: [ClinicalPhotosController, PhotoTemplateGroupsController],
  providers: [ClinicalPhotosService],
  exports: [ClinicalPhotosService],
})
export class ClinicalPhotosModule {}
