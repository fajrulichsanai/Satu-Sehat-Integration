import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OwnerClinicLink } from './entities/owner-clinic-link.entity';
import { User } from '../users/entities/user.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { MultiClinicService } from './multi-clinic.service';
import { MultiClinicController } from './multi-clinic.controller';
import { DashboardModule } from '../dashboard/dashboard.module';
import { ClinicsModule } from '../clinics/clinics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OwnerClinicLink, User, Clinic]),
    DashboardModule,
    ClinicsModule,
  ],
  controllers: [MultiClinicController],
  providers: [MultiClinicService],
})
export class MultiClinicModule {}
