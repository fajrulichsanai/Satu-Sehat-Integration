import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClinicsModule } from './modules/clinics/clinics.module';
import { PractitionersModule } from './modules/practitioners/practitioners.module';
import { LocationsModule } from './modules/locations/locations.module';
import { ExamplesModule } from './modules/examples/examples.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST', 'localhost'),
        port: parseInt(configService.get('DB_PORT', '3306')),
        username: configService.get('DB_USERNAME', 'root'),
        password: configService.get('DB_PASSWORD', 'root'),
        database: configService.get('DB_DATABASE', 'dental_clinic'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false, // Set to false to avoid duplicate key errors
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    ClinicsModule,
    PractitionersModule,
    LocationsModule,
    ExamplesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global JWT guard (can be overridden with @Public() decorator)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
