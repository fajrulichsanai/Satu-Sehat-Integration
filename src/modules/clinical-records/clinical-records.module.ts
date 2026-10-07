import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from '../encounters/entities/encounter.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { TerminologyModule } from '../terminology/terminology.module';
import { SatusehatModule } from '../satusehat/satusehat.module';
import { PatientCondition } from './entities/patient-condition.entity';
import { ClinicalObservation } from './entities/clinical-observation.entity';
import { ClinicalRecordsController } from './clinical-records.controller';
import { ClinicalRecordsService } from './clinical-records.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PatientCondition,
      ClinicalObservation,
      Encounter,
    ]),
    AuditLogModule,
    TerminologyModule,
    SatusehatModule,
  ],
  controllers: [ClinicalRecordsController],
  providers: [ClinicalRecordsService],
})
export class ClinicalRecordsModule {}
