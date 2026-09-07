import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentTemplate } from './entities/consent-template.entity';
import { PatientConsent } from './entities/patient-consent.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { ConsentTemplatesService } from './consent-templates.service';
import { PatientConsentsService } from './patient-consents.service';
import { PatientConsentPdfService } from './patient-consent-pdf.service';
import { ConsentTemplatesController } from './consent-templates.controller';
import { PatientConsentsController } from './patient-consents.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConsentTemplate,
      PatientConsent,
      Patient,
      Clinic,
    ]),
    AuditLogModule,
  ],
  controllers: [ConsentTemplatesController, PatientConsentsController],
  providers: [
    ConsentTemplatesService,
    PatientConsentsService,
    PatientConsentPdfService,
  ],
  exports: [PatientConsentsService],
})
export class ConsentsModule {}
