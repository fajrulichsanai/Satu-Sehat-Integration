import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';
import { Clinic } from '../../entities/clinic.entity';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { UserRole } from '../../enums';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Clinic)
    private clinicRepository: Repository<Clinic>,
    private jwtService: JwtService,
  ) {}

  /**
   * Register new user
   * - Owner: requires owner code, creates clinic
   * - Admin/Dokter: requires existing clinic, pending approval
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
          details: [{ field: 'email', message: `Email ${dto.email} sudah digunakan` }],
        },
      });
    }

    // Validate owner code for owner role
    if (dto.role === UserRole.OWNER) {
      if (!dto.ownerCode) {
        throw new BadRequestException({
          success: false,
          error: {
            code: 'OWNER_CODE_REQUIRED',
            message: 'Kode owner diperlukan untuk registrasi owner',
          },
        });
      }

      // TODO: Validate owner code against whitelist
      // For now, accept any code
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create clinic for owner
    let clinic: Clinic | null = null;
    if (dto.role === UserRole.OWNER) {
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

    // Create user
    const user = this.userRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role === UserRole.OWNER ? UserRole.OWNER : UserRole.PENDING,
      clinicId: clinic?.id || null,
      isActive: dto.role === UserRole.OWNER, // Owner is active immediately
    });

    await this.userRepository.save(user);

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        message:
          dto.role === UserRole.OWNER
            ? 'Registrasi berhasil. Silakan login.'
            : 'Registrasi berhasil. Menunggu persetujuan owner.',
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
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Email atau password salah',
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
   * Send email verification token (mock: logs token to console)
   */
  async sendVerificationEmail(userId: number): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.userRepository.update(userId, { verificationToken: token });
    Logger.log(`[MOCK EMAIL] Verification token for user ${userId}: ${token}`, 'AuthService');
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string) {
    if (!token) throw new BadRequestException('Token verifikasi tidak boleh kosong');

    const user = await this.userRepository.findOne({
      where: { verificationToken: token },
    });
    if (!user) throw new NotFoundException('Token verifikasi tidak valid atau sudah digunakan');

    await this.userRepository.update(user.id, {
      emailVerifiedAt: new Date(),
      verificationToken: null as unknown as string,
    });

    return { success: true, data: { message: 'Email berhasil diverifikasi' } };
  }
}
