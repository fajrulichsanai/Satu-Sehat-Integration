import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Encounter } from '../encounters/entities/encounter.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Practitioner } from '../practitioners/entities/practitioner.entity';
import { Location } from '../location/entities/location.entity';
import { PhysicalExamination } from '../physical-examination/entities/physical-examination.entity';
import { DentalExamination } from '../dental-examination/entities/dental-examination.entity';
import { EncounterSoapNote } from '../encounter-soap-notes/entities/encounter-soap-note.entity';
import { Billing } from '../billing/entities/billing.entity';
import { BillingItem } from '../billing-item/entities/billing-item.entity';
import { PrescriptionItem } from '../prescriptions/entities/prescription-item.entity';
import { ToothCondition } from '../odontogram/entities/tooth-condition.entity';
import { DentalBridge } from '../odontogram/entities/dental-bridge.entity';
import { PatientRecall } from '../recalls/entities/patient-recall.entity';
import { SatusehatSyncLog } from './sync/entities/satusehat-sync-log.entity';
import { SatusehatResourceLink } from './sync/entities/satusehat-resource-link.entity';
import { SatusehatController } from './satusehat.controller';
import { SatusehatClientService } from './satusehat-client.service';
import { SatusehatGlobalOauthService } from './satusehat-global-oauth.service';
import { SatusehatFhirService } from './satusehat-fhir.service';
import { SyncOrchestratorService } from './sync/sync-orchestrator.service';
import { SyncQueueService } from './sync/sync-queue.service';
import { SatusehatMonitorService } from './monitor/satusehat-monitor.service';
import { SatusehatConfigService } from './satusehat-config.service';
import { KfaService } from './kfa/kfa.service';
import { SatusehatOnboardingService } from './onboarding/satusehat-onboarding.service';
import { KfaProductEntity } from './kfa/entities/kfa-product.entity';
import { SsrmeService } from './ssrme/ssrme.service';
import { SsrmeController } from './ssrme/ssrme.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { TerminologyModule } from '../terminology/terminology.module';
import { LabOrder } from '../diagnostics/entities/lab-order.entity';
import { PrescriptionReview } from '../prescriptions/entities/prescription-review.entity';
import { LabResult } from '../diagnostics/entities/lab-result.entity';
import { RadiologyOrder } from '../diagnostics/entities/radiology-order.entity';

@Module({
  imports: [
    ConfigModule,
    AuditLogModule,
    TerminologyModule,
    TypeOrmModule.forFeature([
      Encounter,
      Patient,
      Clinic,
      Practitioner,
      Location,
      PhysicalExamination,
      DentalExamination,
      EncounterSoapNote,
      Billing,
      BillingItem,
      PrescriptionItem,
      ToothCondition,
      DentalBridge,
      PatientRecall,
      SatusehatSyncLog,
      SatusehatResourceLink,
      KfaProductEntity,
      LabOrder,
      LabResult,
      RadiologyOrder,
      PrescriptionReview,
    ]),
  ],
  controllers: [SatusehatController, SsrmeController],
  providers: [
    SatusehatClientService,
    SatusehatGlobalOauthService,
    SatusehatFhirService,
    SyncOrchestratorService,
    SyncQueueService,
    SatusehatMonitorService,
    SatusehatConfigService,
    KfaService,
    SsrmeService,
    SatusehatOnboardingService,
  ],
  exports: [
    SatusehatClientService,
    SatusehatGlobalOauthService,
    SatusehatFhirService,
    SyncOrchestratorService,
    SyncQueueService,
    KfaService,
  ],
})
export class SatusehatModule {}
