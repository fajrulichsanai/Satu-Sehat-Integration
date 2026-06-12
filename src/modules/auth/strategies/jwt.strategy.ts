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
      secretOrKey: configService.get<string>('JWT_SECRET', 'your-secret-key-change-in-production'),
    });
  }

  async validate(payload: any) {
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
      role: payload.role,
      clinicId: payload.clinicId,
      practitionerId: payload.practitionerId,
    };
  }
}
