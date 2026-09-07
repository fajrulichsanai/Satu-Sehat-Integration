import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from './entities/patient.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { EncounterSoapNote } from '../encounter-soap-notes/entities/encounter-soap-note.entity';
import { Billing } from '../billing/entities/billing.entity';
import { SupportingExamImage } from '../supporting-exam/entities/supporting-exam-image.entity';
import { PatientRecall } from '../recalls/entities/patient-recall.entity';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';
import { SatusehatModule } from '../satusehat/satusehat.module';
import { TreatmentPlansModule } from '../treatment-plans/treatment-plans.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Patient,
      Encounter,
      EncounterSoapNote,
      Billing,
      SupportingExamImage,
      PatientRecall,
    ]),
    SatusehatModule,
    TreatmentPlansModule,
    AuditLogModule,
  ],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
