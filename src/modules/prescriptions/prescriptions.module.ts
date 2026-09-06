import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrescriptionItem } from './entities/prescription-item.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionsService } from './prescriptions.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PrescriptionItem, Encounter]),
    AuditLogModule,
  ],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
})
export class PrescriptionsModule {}
