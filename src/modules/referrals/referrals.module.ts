import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Referral } from './entities/referral.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { EncounterSoapNote } from '../encounter-soap-notes/entities/encounter-soap-note.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { SatusehatResourceLink } from '../satusehat/sync/entities/satusehat-resource-link.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SatusehatModule } from '../satusehat/satusehat.module';
import { TerminologyModule } from '../terminology/terminology.module';
import { ReferralsController } from './referrals.controller';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Referral,
      Encounter,
      EncounterSoapNote,
      Clinic,
      SatusehatResourceLink,
    ]),
    AuditLogModule,
    SatusehatModule,
    TerminologyModule,
  ],
  controllers: [ReferralsController],
  providers: [ReferralsService],
})
export class ReferralsModule {}
