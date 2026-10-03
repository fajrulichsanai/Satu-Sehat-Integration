import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportingExamImage } from './entities/supporting-exam-image.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { SupportingExamController } from './supporting-exam.controller';
import { SupportingExamService } from './supporting-exam.service';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportingExamImage, Encounter]),
    AuditLogModule,
  ],
  controllers: [SupportingExamController],
  providers: [SupportingExamService],
})
export class SupportingExamModule {}
