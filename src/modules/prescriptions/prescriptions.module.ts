import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrescriptionItem } from './entities/prescription-item.entity';
import { PrescriptionReview } from './entities/prescription-review.entity';
import { PrescriptionSignature } from './entities/prescription-signature.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { PhysicalExamination } from '../physical-examination/entities/physical-examination.entity';
import { SatusehatResourceLink } from '../satusehat/sync/entities/satusehat-resource-link.entity';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionPdfService } from './prescription-pdf.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PrescriptionItem,
      PrescriptionReview,
      PrescriptionSignature,
      Encounter,
      PhysicalExamination,
      SatusehatResourceLink,
    ]),
    AuditLogModule,
  ],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService, PrescriptionPdfService],
})
export class PrescriptionsModule {}
