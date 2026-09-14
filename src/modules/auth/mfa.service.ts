import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as QRCode from 'qrcode';
import { User } from '../users/entities/user.entity';
import { comparePassword } from '../../common/utils/password.util';
import {
  generateMfaSecret,
  encryptMfaSecret,
  decryptMfaSecret,
  buildOtpauthUrl,
  verifyTotpToken,
  generateBackupCodes,
  hashBackupCode,
  consumeBackupCode,
} from './mfa.util';

export interface MfaSetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

@Injectable()
export class MfaService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Starts (or restarts) enrollment: generates a fresh secret and stores it
   * encrypted, but does NOT enable MFA yet — that only happens once the user
   * proves they can generate a matching code, in enable().
   */
  async setup(userId: number): Promise<MfaSetupResult> {
    const user = await this.getUserOrThrow(userId);
    const secret = generateMfaSecret();
    await this.userRepository.update(user.id, {
      mfaSecret: encryptMfaSecret(secret),
      mfaEnabled: false,
      mfaEnabledAt: null,
      mfaBackupCodes: null,
    });

    const otpauthUrl = buildOtpauthUrl(secret, user.email);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async enable(
    userId: number,
    code: string,
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.getUserOrThrow(userId);
    if (!user.mfaSecret) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'MFA_NOT_SETUP',
          message: 'Mulai proses setup MFA terlebih dahulu',
        },
      });
    }

    const secret = decryptMfaSecret(user.mfaSecret);
    if (!verifyTotpToken(code, secret)) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'MFA_INVALID_CODE', message: 'Kode tidak valid' },
      });
    }

    const backupCodes = generateBackupCodes();
    await this.userRepository.update(user.id, {
      mfaEnabled: true,
      mfaEnabledAt: new Date(),
      mfaBackupCodes: backupCodes.map(hashBackupCode),
    });

    return { backupCodes };
  }

  async disable(userId: number, password: string): Promise<void> {
    const user = await this.getUserOrThrow(userId);
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Password salah' },
      });
    }

    await this.userRepository.update(user.id, {
      mfaSecret: null,
      mfaEnabled: false,
      mfaEnabledAt: null,
      mfaBackupCodes: null,
    });
  }

  async getStatus(userId: number): Promise<{ enabled: boolean }> {
    const user = await this.getUserOrThrow(userId);
    return { enabled: user.mfaEnabled };
  }

  /**
   * Verifies the code (authenticator TOTP or a single-use backup code)
   * presented at the MFA login step. Returns the user on success so
   * AuthService can issue the real access token.
   */
  async verifyLoginCode(userId: number, code: string): Promise<User> {
    const user = await this.getUserOrThrow(userId);
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'MFA_NOT_ENABLED', message: 'MFA tidak aktif' },
      });
    }

    const secret = decryptMfaSecret(user.mfaSecret);
    if (verifyTotpToken(code, secret)) {
      return user;
    }

    const remaining = consumeBackupCode(code, user.mfaBackupCodes ?? []);
    if (remaining) {
      await this.userRepository.update(user.id, { mfaBackupCodes: remaining });
      return user;
    }

    throw new UnauthorizedException({
      success: false,
      error: { code: 'MFA_INVALID_CODE', message: 'Kode tidak valid' },
    });
  }

  private async getUserOrThrow(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'User tidak ditemukan' },
      });
    }
    return user;
  }
}
