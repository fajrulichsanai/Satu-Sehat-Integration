import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './entities/api-key.entity';
import { ApiUsageDaily } from './entities/api-usage-daily.entity';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { PublicApiController } from './public-api.controller';
import { PublicApiService } from './public-api.service';
import { ApiKeyGuard } from './api-key.guard';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Practitioner } from '../practitioners/entities/practitioner.entity';
import { Tarif } from '../tarif/entities/tarif.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { PublicModule } from '../public/public.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, ApiUsageDaily, Clinic, Practitioner, Tarif, Reservation]),
    SubscriptionsModule,
    ReservationsModule,
    PublicModule,
    AuditLogModule,
    StorageModule,
  ],
  controllers: [ApiKeysController, PublicApiController],
  providers: [ApiKeysService, PublicApiService, ApiKeyGuard],
})
export class ApiKeysModule {}
