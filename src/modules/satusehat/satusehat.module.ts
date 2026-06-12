import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from '../../entities/encounter.entity';
import { Patient } from '../../entities/patient.entity';
import { Diagnosis } from '../../entities/diagnosis.entity';
import { Procedure } from '../../entities/procedure.entity';
import { VitalSign } from '../../entities/vital-sign.entity';
import { Prescription } from '../../entities/prescription.entity';
import { Allergy } from '../../entities/allergy.entity';
import { Clinic } from '../../entities/clinic.entity';
import { SatusehatSyncLog } from '../../entities/satusehat-sync-log.entity';
import { SatusehatController } from './satusehat.controller';
import { SatusehatClientService } from './satusehat-client.service';
import { SyncOrchestratorService } from './sync/sync-orchestrator.service';
import { SyncQueueService } from './sync/sync-queue.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Encounter, Patient, Diagnosis, Procedure,
      VitalSign, Prescription, Allergy, Clinic, SatusehatSyncLog,
    ]),
  ],
  controllers: [SatusehatController],
  providers: [SatusehatClientService, SyncOrchestratorService, SyncQueueService],
  exports: [SatusehatClientService, SyncOrchestratorService, SyncQueueService],
})
export class SatusehatModule {}
