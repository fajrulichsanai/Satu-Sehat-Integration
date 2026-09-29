import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { User } from '../users/entities/user.entity';
import { RevokedToken } from './entities/revoked-token.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { OwnerCodeModule } from '../owner-code/owner-code.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Clinic, RevokedToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // Short by default so a stolen token has a small window; revocation
          // (logout/password reset) covers the rest — see JwtStrategy.
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '8h') as any,
        },
      }),
      inject: [ConfigService],
    }),
    OwnerCodeModule,
    AuditLogModule,
    SubscriptionsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, MfaService, JwtStrategy],
  exports: [AuthService, JwtModule, JwtStrategy],
})
export class AuthModule {}
