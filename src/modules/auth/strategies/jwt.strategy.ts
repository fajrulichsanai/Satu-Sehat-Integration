import {
  ForbiddenException,
  Injectable,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { AuthService } from '../auth.service';
import { UserRole } from '../../../enums';
import {
  OwnerClinicLink,
  OwnerClinicLinkStatus,
} from '../../multi-clinic/entities/owner-clinic-link.entity';
import {
  BRANCH_ACTOR_ROLE,
  BRANCH_HEADER,
  isOwnerScopedPath,
  parseBranchHeader,
} from '../branch-context';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
    @Optional()
    @InjectRepository(OwnerClinicLink)
    private readonly linkRepository?: Repository<OwnerClinicLink>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request | undefined, payload: any) {
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
      throw new UnauthorizedException(
        'Sesi sudah berakhir, silakan login ulang',
      );
    }

    if (await this.authService.isTokenRevoked(payload.jti)) {
      throw new UnauthorizedException(
        'Sesi sudah berakhir, silakan login ulang',
      );
    }

    // This will be available as req.user in controllers. Role, clinic and
    // practitioner come from the user row, not the token, so a role change
    // or removal takes effect on the next request instead of at token expiry.
    const base = {
      userId: payload.sub,
      email: user.email,
      name: user.name,
      role: user.role,
      clinicId: user.clinicId,
      practitionerId: user.practitionerId,
      impersonated: !!payload.imp,
      // Raw claims, for logout/refresh to revoke exactly this token.
      tokenClaims: payload,
    };

    if (user.role === UserRole.MULTI_CLINIC_OWNER) {
      return this.withBranch(base, req);
    }
    return base;
  }

  /**
   * Mode Cabang aktif (PRD Multi-Klinik MK-01/MK-02): a Multi-Klinik Owner
   * whose request carries X-Clinic-Id acts as the owner of that branch — same
   * rights as the clinic's own owner, so every existing @Roles(OWNER),
   * @ClinicId() and clinic-scoped query works unchanged. The branch must be
   * linked to this account and approved; anything else is refused, so a
   * hand-crafted header can never open another owner's clinic.
   * Lives here (not in a guard) because many controllers re-run
   * JwtAuthGuard, which would otherwise rebuild req.user without the branch.
   */
  private async withBranch<T extends { userId: number }>(
    base: T,
    req: Request | undefined,
  ) {
    const branchId = parseBranchHeader(req?.headers?.[BRANCH_HEADER]);
    if (!branchId || isOwnerScopedPath(req?.path)) return base;

    const link = await this.linkRepository?.findOne({
      where: {
        ownerId: base.userId,
        clinicId: branchId,
        status: OwnerClinicLinkStatus.APPROVED,
      },
    });
    if (!link) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'CLINIC_NOT_OWNED',
          message: 'Cabang ini tidak terhubung ke akun Anda',
        },
      });
    }
    return {
      ...base,
      role: UserRole.OWNER,
      clinicId: branchId,
      practitionerId: null,
      // The real role, for the audit log and for actions only a clinic's own
      // owner may take (e.g. answering a multiklinik link request).
      actorRole: BRANCH_ACTOR_ROLE,
      branchMode: true,
    };
  }
}
