import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhysicalExamination } from './entities/physical-examination.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { PhysicalExaminationController } from './physical-examination.controller';
import { PhysicalExaminationService } from './physical-examination.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PhysicalExamination, Encounter]),
    AuditLogModule,
  ],
  controllers: [PhysicalExaminationController],
  providers: [PhysicalExaminationService],
})
export class PhysicalExaminationModule {}
