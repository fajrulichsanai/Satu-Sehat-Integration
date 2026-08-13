import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClinicsModule } from './modules/clinics/clinics.module';
import { PractitionersModule } from './modules/practitioners/practitioners.module';
import { LocationsModule } from './modules/locations/locations.module';
import { PatientsModule } from './modules/patients/patients.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { PublicModule } from './modules/public/public.module';
import { EncountersModule } from './modules/encounters/encounters.module';
import { BillingModule } from './modules/billing/billing.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SatusehatModule } from './modules/satusehat/satusehat.module';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { SoapTemplatesModule } from './modules/soap-templates/soap-templates.module';
import { IcdModule } from './modules/icd/icd.module';
import { OwnerCodeModule } from './modules/owner-code/owner-code.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { OperationalRecordsModule } from './modules/operational-records/operational-records.module';
import { DoctorFeeModule } from './modules/doctor-fee/doctor-fee.module';
import { EncounterSoapNotesModule } from './modules/encounter-soap-notes/encounter-soap-notes.module';
import { TreatmentPlansModule } from './modules/treatment-plans/treatment-plans.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { GudangModule } from './modules/gudang/gudang.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from './modules/subscriptions/guards/subscription.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const nodeEnv = configService.get<string>('NODE_ENV', 'development');
        const synchronize =
          configService.get<string>(
            'DB_SYNCHRONIZE',
            nodeEnv !== 'production' ? 'true' : 'false',
          ) === 'true';
        return {
          type: 'mysql',
          host: configService.get('DB_HOST', 'localhost'),
          port: parseInt(configService.get('DB_PORT', '3306')),
          username: configService.get('DB_USERNAME', 'root'),
          password: configService.get('DB_PASSWORD', 'root'),
          database: configService.get('DB_DATABASE', 'dental_clinic'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize,
          charset: 'utf8mb4',
          timezone: '+07:00',
          extra: {
            dateStrings: ['DATE'],
          },
          logging: nodeEnv === 'development' ? ['error', 'warn'] : false,
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    ClinicsModule,
    PractitionersModule,
    LocationsModule,
    PatientsModule,
    ReservationsModule,
    PublicModule,
    EncountersModule,
    BillingModule,
    ReportsModule,
    SatusehatModule,
    MasterDataModule,
    SoapTemplatesModule,
    IcdModule,
    OwnerCodeModule,
    DashboardModule,
    OperationalRecordsModule,
    DoctorFeeModule,
    EncounterSoapNotesModule,
    TreatmentPlansModule,
    AuditLogModule,
    GudangModule,
    SubscriptionsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global JWT guard (can be overridden with @Public() decorator)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global subscription-expiry gate on every mutating request — see
    // SubscriptionGuard for the exemptions (SUPER_ADMIN, @SkipSubscriptionCheck routes).
    {
      provide: APP_GUARD,
      useExisting: SubscriptionGuard,
    },
  ],
})
export class AppModule {}
