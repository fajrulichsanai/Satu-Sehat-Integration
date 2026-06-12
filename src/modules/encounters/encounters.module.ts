import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from '../../entities/encounter.entity';
import { Queue } from '../../entities/queue.entity';
import { Anamnesis } from '../../entities/anamnesis.entity';
import { Allergy } from '../../entities/allergy.entity';
import { MedicationHistory } from '../../entities/medication-history.entity';
import { VitalSign } from '../../entities/vital-sign.entity';
import { Diagnosis } from '../../entities/diagnosis.entity';
import { Procedure } from '../../entities/procedure.entity';
import { Prescription } from '../../entities/prescription.entity';
import { Dispense } from '../../entities/dispense.entity';
import { Medication } from '../../entities/medication.entity';
import { MedicationStockLog } from '../../entities/medication-stock-log.entity';
import { OdontogramData } from '../../entities/odontogram-data.entity';
import { OhisData } from '../../entities/ohis-data.entity';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { AnamnesisController } from './anamnesis.controller';
import { AnamnesisService } from './anamnesis.service';
import { VitalSignsController } from './vital-signs.controller';
import { VitalSignsService } from './vital-signs.service';
import { DiagnosesController } from './diagnoses.controller';
import { DiagnosesService } from './diagnoses.service';
import { ProceduresController } from './procedures.controller';
import { ProceduresService } from './procedures.service';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { DispenseController } from './dispense.controller';
import { DispenseService } from './dispense.service';
import { OdontogramController } from './odontogram.controller';
import { OdontogramService } from './odontogram.service';
import { OhisController } from './ohis.controller';
import { OhisService } from './ohis.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Encounter,
      Queue,
      Anamnesis,
      Allergy,
      MedicationHistory,
      VitalSign,
      Diagnosis,
      Procedure,
      Prescription,
      Dispense,
      Medication,
      MedicationStockLog,
      OdontogramData,
      OhisData,
    ]),
  ],
  controllers: [
    EncountersController,
    AnamnesisController,
    VitalSignsController,
    DiagnosesController,
    ProceduresController,
    PrescriptionsController,
    DispenseController,
    OdontogramController,
    OhisController,
  ],
  providers: [
    EncountersService,
    AnamnesisService,
    VitalSignsService,
    DiagnosesService,
    ProceduresService,
    PrescriptionsService,
    DispenseService,
    OdontogramService,
    OhisService,
  ],
  exports: [EncountersService],
})
export class EncountersModule {}
