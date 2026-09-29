import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DentalExamination } from './entities/dental-examination.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { DentalExaminationController } from './dental-examination.controller';
import { DentalExaminationService } from './dental-examination.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DentalExamination, Encounter]),
    AuditLogModule,
  ],
  controllers: [DentalExaminationController],
  providers: [DentalExaminationService],
})
export class DentalExaminationModule {}
