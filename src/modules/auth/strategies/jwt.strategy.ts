import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // A short-lived MFA challenge token (see AuthService.login) is only ever
    // valid for POST /auth/mfa/verify-login — it must never be accepted as a
    // normal bearer token, even though it's signed with the same secret.
    if (payload.type === 'mfa_challenge') {
      throw new UnauthorizedException('Token tidak valid');
    }

    // Payload contains: sub (userId), email, role, clinicId, practitionerId
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User tidak ditemukan');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User tidak aktif');
    }

    // This will be available as req.user in controllers
    return {
      userId: payload.sub,
      email: payload.email,
      name: user.name,
      role: payload.role,
      clinicId: payload.clinicId,
      practitionerId: payload.practitionerId,
      // Read fresh off the user row (not the JWT) so MfaEnforcementGuard sees
      // it flip to true the moment MFA is enabled, without needing a new
      // token — validateUser above already fetches the row, so this is free.
      mfaEnabled: user.mfaEnabled,
    };
  }
}
