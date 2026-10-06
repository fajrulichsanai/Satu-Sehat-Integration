import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { User } from '../users/entities/user.entity';
import { ClinicFeature } from './entities/clinic-feature.entity';
import { CustomFeature } from './entities/custom-feature.entity';
import { UserFeature } from './entities/user-feature.entity';
import { FeaturesService } from './features.service';
import { FeaturesController } from './features.controller';
import { FeatureAccessGuard } from './feature-access.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CustomFeature,
      ClinicFeature,
      UserFeature,
      User,
      Clinic,
    ]),
  ],
  controllers: [FeaturesController],
  providers: [FeaturesService, FeatureAccessGuard],
  exports: [FeaturesService, FeatureAccessGuard],
})
export class FeaturesModule {}
