import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Encounter } from '../encounters/entities/encounter.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { TerminologyModule } from '../terminology/terminology.module';
import { LabOrder } from './entities/lab-order.entity';
import { LabResult } from './entities/lab-result.entity';
import { RadiologyOrder } from './entities/radiology-order.entity';
import { SatusehatResourceLink } from '../satusehat/sync/entities/satusehat-resource-link.entity';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LabOrder,
      LabResult,
      RadiologyOrder,
      Encounter,
      SatusehatResourceLink,
    ]),
    AuditLogModule,
    TerminologyModule,
  ],
  controllers: [DiagnosticsController],
  providers: [DiagnosticsService],
})
export class DiagnosticsModule {}
