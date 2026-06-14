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
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { User } from '../users/entities/user.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { UserRole } from '../../enums';
import { OwnerCodeService } from '../owner-code/owner-code.service';

@Injectable()
export class AuthService {
  private resend: Resend;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private ownerCodeService: OwnerCodeService,
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

    // Validate owner code
    const isValidOwnerCode = await this.ownerCodeService.validate(
      dto.ownerCode || '',
    );

    if (!isValidOwnerCode && dto.ownerCode) {
      Logger.warn(
        `Invalid owner code for user ${dto.email}. Role set to PENDING.`,
        'AuthService',
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password!, 10);

    // Determine user role and active status based on owner code validity
    const userRole = isValidOwnerCode ? UserRole.OWNER : UserRole.PENDING;
    const isActive = isValidOwnerCode;

    // Create user (clinicId will be set later when owner creates clinic)
    const user = this.userRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: userRole,
      clinicId: null,
      isActive,
    });

    await this.userRepository.save(user);

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

    // Verify password
    const isPasswordValid = await bcrypt.compare(
      dto.password!,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email atau password salah',
        },
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

    // Generate JWT token
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      clinicId: user.clinicId,
      practitionerId: user.practitionerId,
    };

    const accessToken = this.jwtService.sign(payload);

    // Update last login
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
    });

    return {
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          clinicId: user.clinicId,
          practitionerId: user.practitionerId,
          isActive: user.isActive,
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
   * Refresh access token using refresh token (JWT re-sign)
   * Simple implementation: validate existing token and re-issue
   */
  async refreshToken(userId: number) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'INVALID_REFRESH', message: 'Token tidak valid' },
      });
    }
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      clinicId: user.clinicId,
      practitionerId: user.practitionerId,
    };
    const accessToken = this.jwtService.sign(payload);
    return { success: true, data: { accessToken } };
  }

  /**
   * Logout (stateless — client should discard token)
   */
  async logout() {
    return { success: true, data: { message: 'Logged out successfully' } };
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
    const verificationUrl = `${appUrl}/auth/verify-email?token=${token}`;

    try {
      await this.resend.emails.send({
        from: 'noreply@send.finarch.my.id',
        to: userEmail,
        subject: 'Verifikasi Email Anda - Satu Sehat',
        html: `
          <h2>Verifikasi Email</h2>
          <p>Halo,</p>
          <p>Terima kasih telah mendaftar di Satu Sehat. Silakan verifikasi email Anda dengan mengklik tombol di bawah ini:</p>
          <a href="${verificationUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">
            Verifikasi Email
          </a>
          <p>Atau salin dan buka link berikut di browser Anda:</p>
          <p>${verificationUrl}</p>
          <p>Link ini berlaku selama 24 jam.</p>
          <p>Jika Anda tidak mendaftar akun ini, abaikan email ini.</p>
          <p>Salam,<br>Tim Satu Sehat</p>
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
      verificationToken: null as unknown as string,
    });

    return { success: true, data: { message: 'Email berhasil diverifikasi' } };
  }
}
