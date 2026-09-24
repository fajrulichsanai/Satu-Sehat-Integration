import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { User } from '../users/entities/user.entity';
import { RevokedToken } from './entities/revoked-token.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { UserRole } from '../../enums';
import { OwnerCodeService } from '../owner-code/owner-code.service';
import { ClinicSubscriptionsService } from '../subscriptions/clinic-subscriptions.service';
import { MfaService } from './mfa.service';
import { MFA_ENFORCED_ROLES } from './guards/mfa-enforcement.guard';
import {
  hashPassword,
  comparePassword,
} from '../../common/utils/password.util';

const MFA_CHALLENGE_TYPE = 'mfa_challenge';

/** Failed password attempts before an account is locked. */
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;
/** Absolute session lifetime: /auth/refresh can't extend past this since login. */
const MAX_SESSION_HOURS = 24;

/** Claims every access token carries; see signAccessToken(). */
export interface AccessTokenClaims {
  sub: number;
  email: string;
  role: UserRole;
  clinicId: number | null;
  practitionerId: number | null;
  /** Token id, for per-token revocation (logout/refresh). */
  jti: string;
  /** users.token_version at issue time; a bump revokes all older tokens. */
  tv: number;
  /** Original login time (epoch seconds), carried across refreshes. */
  at: number;
  /** Set on Super Admin impersonation tokens. */
  imp?: boolean;
  exp?: number;
}

@Injectable()
export class AuthService {
  private resend: Resend;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Clinic)
    private clinicRepository: Repository<Clinic>,
    @InjectRepository(RevokedToken)
    private revokedTokenRepository: Repository<RevokedToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private ownerCodeService: OwnerCodeService,
    private clinicSubscriptionsService: ClinicSubscriptionsService,
    private mfaService: MfaService,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  /**
   * Register new user
   * - Valid owner code: assign OWNER role, create clinic, set active
   * - No/invalid owner code: assign PENDING role, requires approval
   */
  async register(dto: RegisterDto) {
    // Check if email already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_EXISTS',
          message: 'Email sudah terdaftar',
          details: [
            { field: 'email', message: `Email ${dto.email} sudah digunakan` },
          ],
        },
      });
    }

    // Validate owner code if provided
    let isValidOwnerCode = false;
    if (dto.ownerCode) {
      isValidOwnerCode = await this.ownerCodeService.validate(dto.ownerCode);
      if (!isValidOwnerCode) {
        throw new BadRequestException({
          success: false,
          error: {
            code: 'INVALID_OWNER_CODE',
            message: 'Owner code tidak valid',
            details: [
              {
                field: 'ownerCode',
                message:
                  'Owner code yang Anda masukkan tidak valid atau sudah digunakan',
              },
            ],
          },
        });
      }
    }

    // Hash password
    const passwordHash = await hashPassword(dto.password!);

    // Create clinic for owner (only if owner code is valid)
    let clinic: Clinic | null = null;
    if (isValidOwnerCode) {
      clinic = this.clinicRepository.create({
        name: `Klinik ${dto.name}`,
        address: 'To be completed',
        city: 'To be completed',
        province: 'To be completed',
        phone: '000000000',
        setupComplete: false,
      });
      clinic = await this.clinicRepository.save(clinic);
    }

    // Determine user role and active status based on owner code validity
    const userRole = isValidOwnerCode ? UserRole.OWNER : UserRole.PENDING;
    const isActive = isValidOwnerCode;

    // Create user
    const user = this.userRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: userRole,
      clinicId: clinic?.id || null,
      isActive,
    });

    await this.userRepository.save(user);

    // New clinic gets an automatic 15-day free trial (see PRD bagian 7) so
    // it isn't immediately locked out by SubscriptionGuard before ever
    // reaching the payment flow.
    if (clinic) {
      await this.clinicSubscriptionsService.provisionTrialForNewClinic(
        clinic.id,
        user.id,
      );
    }

    // Mark owner code as used if valid
    if (isValidOwnerCode && dto.ownerCode) {
      try {
        await this.ownerCodeService.markAsUsed(dto.ownerCode, user.id);
      } catch (error) {
        Logger.error(
          `Failed to mark owner code as used: ${error instanceof Error ? error.message : String(error)}`,
          'AuthService',
        );
      }
    }

    // Send verification email
    try {
      await this.sendVerificationEmail(user.id, user.email);
    } catch (error) {
      Logger.error(
        `Failed to send verification email to ${user.email}: ${error instanceof Error ? error.message : String(error)}`,
        'AuthService',
      );
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        message:
          userRole === UserRole.OWNER
            ? 'Registrasi owner berhasil. Silakan verifikasi email untuk login.'
            : 'Registrasi berhasil. Status role Anda pending, menunggu persetujuan owner.',
      },
    };
  }

  /**
   * Login user
   */
  async login(dto: LoginDto) {
    // Find user
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email atau password salah',
        },
      });
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutesLeft = Math.max(
        1,
        Math.round((user.lockedUntil.getTime() - Date.now()) / 60_000),
      );
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: `Akun dikunci sementara karena terlalu banyak percobaan login gagal. Coba lagi dalam ${minutesLeft} menit.`,
        },
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(
      dto.password!,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      await this.recordFailedLogin(user);
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email atau password salah',
        },
      });
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.userRepository.update(user.id, {
        failedLoginAttempts: 0,
        lockedUntil: null,
      });
    }

    // Check if email is verified
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message:
            'Email Anda belum diverifikasi. Silakan cek email Anda untuk link verifikasi.',
        },
      });
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'USER_NOT_ACTIVE',
          message: 'Akun Anda belum diaktivasi. Hubungi owner klinik.',
        },
      });
    }

    if (user.mfaEnabled) {
      const mfaToken = this.jwtService.sign(
        { sub: user.id, type: MFA_CHALLENGE_TYPE },
        { expiresIn: '5m' },
      );
      return {
        success: true,
        data: { mfaRequired: true, mfaToken },
      };
    }

    return this.buildLoginResponse(user);
  }

  /**
   * Second step of login when the account has MFA enabled: exchanges the
   * short-lived challenge token from login() plus a TOTP/backup code for the
   * real access token.
   */
  async verifyMfaLogin(mfaToken: string, code: string) {
    let payload: { sub: number; type: string };
    try {
      payload = this.jwtService.verify(mfaToken);
    } catch {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'MFA_TOKEN_INVALID',
          message: 'Sesi login MFA sudah kedaluwarsa, silakan login ulang',
        },
      });
    }
    if (payload.type !== MFA_CHALLENGE_TYPE) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'MFA_TOKEN_INVALID', message: 'Token tidak valid' },
      });
    }

    const user = await this.mfaService.verifyLoginCode(payload.sub, code);
    return this.buildLoginResponse(user);
  }

  /** Counts a wrong password; the MAX_FAILED_LOGINS-th locks the account. */
  private async recordFailedLogin(user: User) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    if (attempts >= MAX_FAILED_LOGINS) {
      await this.userRepository.update(user.id, {
        failedLoginAttempts: 0,
        lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000),
      });
      Logger.warn(
        `[LOCKOUT] Akun dikunci ${LOCKOUT_MINUTES} menit setelah ${attempts} percobaan gagal | userId=${user.id}`,
        'AuthService',
      );
    } else {
      await this.userRepository.update(user.id, {
        failedLoginAttempts: attempts,
      });
    }
  }

  /** Issues an access token. Role/clinic in it are informational only — the
   * JwtStrategy re-reads them from the user row on every request. */
  private signAccessToken(
    user: User,
    opts: { impersonated?: boolean; authTime?: number; expiresIn?: string } = {},
  ): string {
    const claims: AccessTokenClaims = {
      sub: user.id,
      email: user.email,
      role: user.role,
      clinicId: user.clinicId,
      practitionerId: user.practitionerId,
      jti: crypto.randomUUID(),
      tv: user.tokenVersion ?? 0,
      at: opts.authTime ?? Math.floor(Date.now() / 1000),
      ...(opts.impersonated ? { imp: true } : {}),
    };
    return opts.expiresIn
      ? this.jwtService.sign(claims, { expiresIn: opts.expiresIn as any })
      : this.jwtService.sign(claims);
  }

  private async buildLoginResponse(user: User) {
    const accessToken = this.signAccessToken(user);

    // Update last login
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
    });

    return {
      success: true,
      data: {
        accessToken,
        mfaSetupRequired:
          MFA_ENFORCED_ROLES.includes(user.role) && !user.mfaEnabled,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clinicId: user.clinicId,
          practitionerId: user.practitionerId,
          isActive: user.isActive,
          mfaEnabled: user.mfaEnabled,
        },
      },
    };
  }

  /**
   * Super Admin support tool: issue a token that authenticates as another
   * user, so support/debugging can be done from that user's exact
   * perspective. Short-lived (1h, vs the normal 24h) since it's meant for a
   * single support session, not standing access. The caller (AuthController)
   * is responsible for audit-logging who impersonated whom.
   */
  async impersonate(targetUserId: number) {
    const target = await this.userRepository.findOne({
      where: { id: targetUserId },
    });

    if (!target) {
      throw new NotFoundException({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User tidak ditemukan' },
      });
    }

    if (target.role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'CANNOT_IMPERSONATE_SUPER_ADMIN',
          message: 'Tidak dapat impersonate sesama Super Admin',
        },
      });
    }

    if (!target.isActive) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'USER_NOT_ACTIVE',
          message: 'User ini belum aktif',
        },
      });
    }

    const accessToken = this.signAccessToken(target, {
      impersonated: true,
      expiresIn: '1h',
    });

    return {
      success: true,
      data: {
        accessToken,
        user: {
          id: target.id,
          email: target.email,
          name: target.name,
          role: target.role,
          clinicId: target.clinicId,
          practitionerId: target.practitionerId,
          isActive: target.isActive,
        },
      },
    };
  }

  /**
   * Get current user profile
   */
  async getMe(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User tidak ditemukan',
        },
      });
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        clinicId: user.clinicId,
        practitionerId: user.practitionerId,
        isActive: user.isActive,
        emailVerifiedAt: user.emailVerifiedAt,
        lastLoginAt: user.lastLoginAt,
      },
    };
  }

  /**
   * Get activation status (for frontend polling after register)
   */
  async getActivationStatus(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    console.log(
      `Checking activation status for user ${userId}: isActive=${user?.isActive}`,
    );
    if (!user) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User tidak ditemukan' },
      });
    }
    return {
      success: true,
      data: {
        isActive: user.isActive,
        role: user.role,
        clinicId: user.clinicId ?? null,
      },
    };
  }

  /**
   * Re-issues the caller's access token and revokes the old one. Refreshing
   * can't extend a session past MAX_SESSION_HOURS after the original login,
   * and impersonation tokens can't be refreshed at all.
   */
  async refreshToken(current: AccessTokenClaims) {
    const user = await this.userRepository.findOne({
      where: { id: current.sub },
    });
    const sessionAgeSeconds = Math.floor(Date.now() / 1000) - (current.at ?? 0);
    if (
      !user ||
      !user.isActive ||
      current.imp ||
      !current.at ||
      sessionAgeSeconds > MAX_SESSION_HOURS * 3600
    ) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'INVALID_REFRESH', message: 'Sesi berakhir, silakan login ulang' },
      });
    }
    const accessToken = this.signAccessToken(user, { authTime: current.at });
    await this.revokeToken(current);
    return { success: true, data: { accessToken } };
  }

  /**
   * Logout: revokes the caller's token so it stops working immediately,
   * rather than staying valid until it expires.
   */
  async logout(current?: AccessTokenClaims) {
    if (current) await this.revokeToken(current);
    return { success: true, data: { message: 'Logged out successfully' } };
  }

  private async revokeToken(claims: AccessTokenClaims) {
    // Tokens issued before jti existed can't be individually revoked; they
    // simply run out at their original expiry.
    if (!claims.jti || !claims.exp) return;
    await this.revokedTokenRepository.upsert(
      { jti: claims.jti, expiresAt: new Date(claims.exp * 1000) },
      ['jti'],
    );
  }

  async isTokenRevoked(jti: string | undefined): Promise<boolean> {
    if (!jti) return false;
    return this.revokedTokenRepository.exists({ where: { jti } });
  }

  /** Denylist rows are useless once the token has expired anyway. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeExpiredRevokedTokens() {
    await this.revokedTokenRepository.delete({ expiresAt: LessThan(new Date()) });
  }

  /**
   * Validate user by ID (used by JWT strategy)
   */
  async validateUser(userId: number): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId },
    });
  }

  /**
   * Send email verification token via Resend
   */
  async sendVerificationEmail(
    userId: number,
    userEmail: string,
  ): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.userRepository.update(userId, { verificationToken: token });

    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    const verificationUrl = `${appUrl}/verify-email?token=${token}`;

    try {
      await this.resend.emails.send({
        from: 'noreply@send.finarch.my.id',
        to: userEmail,
        subject: 'Verifikasi Email Anda - ApexRecord',
        html: `
          <h2>Verifikasi Email</h2>
          <p>Halo,</p>
          <p>Terima kasih telah mendaftar di ApexRecord. Silakan verifikasi email Anda dengan mengklik tombol di bawah ini:</p>
          <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
            Verifikasi Email
          </a>
          <p>Atau salin dan buka link berikut di browser Anda:</p>
          <p>${verificationUrl}</p>
          <p>Link ini berlaku selama 24 jam.</p>
          <p>Jika Anda tidak mendaftar akun ini, abaikan email ini.</p>
          <p>Salam,<br>Tim ApexRecord</p>
        `,
      });
      Logger.log(`Verification email sent to ${userEmail}`, 'AuthService');
    } catch (error) {
      Logger.error(
        `Failed to send verification email to ${userEmail}: ${error instanceof Error ? error.message : String(error)}`,
        'AuthService',
      );
      throw error;
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string) {
    if (!token)
      throw new BadRequestException('Token verifikasi tidak boleh kosong');

    const user = await this.userRepository.findOne({
      where: { verificationToken: token },
    });
    if (!user)
      throw new NotFoundException(
        'Token verifikasi tidak valid atau sudah digunakan',
      );

    await this.userRepository.update(user.id, {
      emailVerifiedAt: new Date(),
      isActive: true,
      verificationToken: null as unknown as string,
    });

    Logger.log(`[VERIFY] Email berhasil diverifikasi | userId=${user.id}`);
    return { success: true, data: { message: 'Email berhasil diverifikasi' } };
  }

  /**
   * Request password reset — always responds with a generic success message
   * to avoid leaking whether an email is registered.
   */
  async forgotPassword(email: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.userRepository.update(user.id, {
        resetPasswordToken: token,
        resetPasswordExpiresAt: expiresAt,
      });

      try {
        await this.sendResetPasswordEmail(user.email, token);
      } catch (error) {
        Logger.error(
          `Failed to send reset password email to ${user.email}: ${error instanceof Error ? error.message : String(error)}`,
          'AuthService',
        );
      }
    }

    return {
      success: true,
      data: {
        message:
          'Jika email terdaftar, tautan reset password telah dikirim ke email Anda.',
      },
    };
  }

  /**
   * Send reset password token via Resend
   */
  async sendResetPasswordEmail(
    userEmail: string,
    token: string,
  ): Promise<void> {
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    const resetUrl = `${appUrl}/reset-password?token=${token}`;

    await this.resend.emails.send({
      from: 'noreply@send.finarch.my.id',
      to: userEmail,
      subject: 'Reset Password Anda - ApexRecord',
      html: `
        <h2>Reset Password</h2>
        <p>Halo,</p>
        <p>Kami menerima permintaan untuk mereset password akun Anda. Silakan klik tombol di bawah ini untuk membuat password baru:</p>
        <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
          Reset Password
        </a>
        <p>Atau salin dan buka link berikut di browser Anda:</p>
        <p>${resetUrl}</p>
        <p>Link ini berlaku selama 1 jam.</p>
        <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
        <p>Salam,<br>Tim ApexRecord</p>
      `,
    });
    Logger.log(`Reset password email sent to ${userEmail}`, 'AuthService');
  }

  /**
   * Reset password using token
   */
  async resetPassword(token: string, newPassword: string) {
    if (!token) throw new BadRequestException('Token reset tidak boleh kosong');

    const user = await this.userRepository.findOne({
      where: { resetPasswordToken: token },
    });

    if (!user) {
      throw new NotFoundException(
        'Token reset tidak valid atau sudah digunakan',
      );
    }

    if (
      !user.resetPasswordExpiresAt ||
      user.resetPasswordExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Token reset telah kadaluarsa');
    }

    const passwordHash = await hashPassword(newPassword);

    await this.userRepository.update(user.id, {
      passwordHash,
      resetPasswordToken: null as unknown as string,
      resetPasswordExpiresAt: null as unknown as Date,
      // A reset password must also end every session opened with the old one.
      tokenVersion: (user.tokenVersion ?? 0) + 1,
      failedLoginAttempts: 0,
      lockedUntil: null,
    });

    Logger.log(`[RESET] Password berhasil direset | userId=${user.id}`);
    return { success: true, data: { message: 'Password berhasil direset' } };
  }
}
