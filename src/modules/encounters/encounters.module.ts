import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from './entities/encounter.entity';
import { Queue } from '../queues/entities/queue.entity';
import { Anamnesis } from '../anamnesis/entities/anamnesis.entity';
import { Allergy } from '../allergy/entities/allergy.entity';
import { MedicationHistory } from '../medical-history/entities/medication-history.entity';
import { VitalSign } from '../vital-sign/entities/vital-sign.entity';
import { Diagnosis } from '../diagnoses/entities/diagnosis.entity';
import { Procedure } from '../procedures/entities/procedure.entity';
import { Prescription } from '../prescription/entities/prescription.entity';
import { Dispense } from '../dispense/entities/dispense.entity';
import { Medication } from '../medications/entities/medication.entity';
import { MedicationStockLog } from '../medication-stock-log/entities/medication-stock-log.entity';
import { OdontogramData } from '../odontogram-data/entities/odontogram-data.entity';
import { OhisData } from '../ohis-data/entities/ohis-data.entity';
import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { AnamnesisController } from '../anamnesis/anamnesis.controller';
import { AnamnesisService } from '../anamnesis/anamnesis.service';
import { VitalSignsController } from '../vital-sign/vital-signs.controller';
import { VitalSignsService } from '../vital-sign/vital-signs.service';
import { DiagnosesController } from '../diagnoses/diagnoses.controller';
import { DiagnosesService } from '../diagnoses/diagnoses.service';
import { ProceduresController } from '../procedures/procedures.controller';
import { ProceduresService } from '../procedures/procedures.service';
import { PrescriptionsController } from '../prescription/prescriptions.controller';
import { PrescriptionsService } from '../prescription/prescriptions.service';
import { DispenseController } from '../dispense/dispense.controller';
import { DispenseService } from '../dispense/dispense.service';
import { OdontogramController } from '../odontogram-data/odontogram.controller';
import { OdontogramService } from '../odontogram-data/odontogram.service';
import { OhisController } from '../ohis-data/ohis.controller';
import { OhisService } from '../ohis-data/ohis.service';

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
