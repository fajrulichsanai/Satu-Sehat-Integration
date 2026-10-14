import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { User } from '../users/entities/user.entity';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ClinicFeature } from './entities/clinic-feature.entity';
import { PlatformSetting } from './entities/platform-setting.entity';
import { UserFeature } from './entities/user-feature.entity';
import { FeaturesService } from './features.service';
import { FeaturesController } from './features.controller';
import { FeatureAccessGuard } from './feature-access.guard';
import { PlatformSettingsService } from './platform-settings.service';

@Module({
  imports: [
    AuditLogModule,
    TypeOrmModule.forFeature([
      ClinicFeature,
      UserFeature,
      PlatformSetting,
      User,
      Clinic,
    ]),
  ],
  controllers: [FeaturesController],
  providers: [FeaturesService, FeatureAccessGuard, PlatformSettingsService],
  exports: [FeaturesService, FeatureAccessGuard, PlatformSettingsService],
})
export class FeaturesModule {}
