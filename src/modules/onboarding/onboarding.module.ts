import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Tarif } from '../tarif/entities/tarif.entity';
import { Practitioner } from '../practitioners/entities/practitioner.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Clinic, Tarif, Practitioner])],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
