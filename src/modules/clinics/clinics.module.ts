import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicsController } from './clinics.controller';
import { ClinicsService } from './clinics.service';
import { Clinic } from './entities/clinic.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Clinic])],
  controllers: [ClinicsController],
  providers: [ClinicsService],
  exports: [ClinicsService],
})
export class ClinicsModule {}
