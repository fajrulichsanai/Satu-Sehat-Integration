import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicsController, ClinicsListController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { Clinic } from './entities/clinic.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Clinic]), AuditLogModule],
  controllers: [ClinicsController, ClinicsListController],
  providers: [ClinicsService],
  exports: [ClinicsService],
})
export class ClinicsModule {}
