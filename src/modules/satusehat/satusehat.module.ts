import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Encounter } from '../encounters/entities/encounter.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { SatusehatSyncLog } from './sync/entities/satusehat-sync-log.entity';
import { SatusehatController } from './satusehat.controller';
import { SatusehatClientService } from './satusehat-client.service';
import { SatusehatGlobalOauthService } from './satusehat-global-oauth.service';
import { SatusehatFhirService } from './satusehat-fhir.service';
import { SyncOrchestratorService } from './sync/sync-orchestrator.service';
import { SyncQueueService } from './sync/sync-queue.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Encounter, Patient, Clinic, SatusehatSyncLog]),
  ],
  controllers: [SatusehatController],
  providers: [
    SatusehatClientService,
    SatusehatGlobalOauthService,
    SatusehatFhirService,
    SyncOrchestratorService,
    SyncQueueService,
  ],
  exports: [
    SatusehatClientService,
    SatusehatGlobalOauthService,
    SatusehatFhirService,
    SyncOrchestratorService,
    SyncQueueService,
  ],
})
export class SatusehatModule {}
