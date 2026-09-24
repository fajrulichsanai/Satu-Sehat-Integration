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

    // Payload: see AccessTokenClaims in auth.service.ts
    const user = await this.authService.validateUser(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User tidak ditemukan');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User tidak aktif');
    }

    // token_version bumped (e.g. password reset) → every older token is dead.
    // Tokens issued before `tv` existed count as version 0.
    if ((payload.tv ?? 0) !== (user.tokenVersion ?? 0)) {
      throw new UnauthorizedException('Sesi sudah berakhir, silakan login ulang');
    }

    if (await this.authService.isTokenRevoked(payload.jti)) {
      throw new UnauthorizedException('Sesi sudah berakhir, silakan login ulang');
    }

    // This will be available as req.user in controllers. Role, clinic and
    // practitioner come from the user row, not the token, so a role change
    // or removal takes effect on the next request instead of at token expiry.
    return {
      userId: payload.sub,
      email: user.email,
      name: user.name,
      role: user.role,
      clinicId: user.clinicId,
      practitionerId: user.practitionerId,
      impersonated: !!payload.imp,
      // Raw claims, for logout/refresh to revoke exactly this token.
      tokenClaims: payload,
      // Read fresh off the user row (not the JWT) so MfaEnforcementGuard sees
      // it flip to true the moment MFA is enabled, without needing a new
      // token — validateUser above already fetches the row, so this is free.
      mfaEnabled: user.mfaEnabled,
    };
  }
}
