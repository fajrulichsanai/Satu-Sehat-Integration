import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrescriptionItem } from './entities/prescription-item.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { PhysicalExamination } from '../physical-examination/entities/physical-examination.entity';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { PrescriptionPdfService } from './prescription-pdf.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PrescriptionItem,
      Encounter,
      PhysicalExamination,
    ]),
    AuditLogModule,
  ],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService, PrescriptionPdfService],
})
export class PrescriptionsModule {}
