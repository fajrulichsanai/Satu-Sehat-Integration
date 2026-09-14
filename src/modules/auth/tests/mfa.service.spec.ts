process.env.MFA_ENCRYPTION_KEY = 'test-mfa-key-not-for-production';

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import { MfaService } from '../mfa.service';
import { User } from '../../users/entities/user.entity';
import {
  encryptMfaSecret,
  generateBackupCodes,
  hashBackupCode,
} from '../mfa.util';

jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
}));

describe('MfaService', () => {
  let service: MfaService;
  let userRepo: { findOne: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MfaService,
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get<MfaService>(MfaService);
  });

  describe('setup', () => {
    it('stores an encrypted secret and returns a QR code (positive)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, email: 'a@x.com' });

      const result = await service.setup(1);

      expect(result.secret).toMatch(/^[A-Z2-7]+$/); // base32
      expect(result.otpauthUrl).toContain('a%40x.com');
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(userRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ mfaEnabled: false }),
      );
    });

    it('throws when the user does not exist (negative)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.setup(999)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('enable', () => {
    it('turns MFA on and returns backup codes for a valid code (positive)', async () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      userRepo.findOne.mockResolvedValue({
        id: 1,
        email: 'a@x.com',
        mfaSecret: encryptMfaSecret(secret),
      });
      const code = authenticator.generate(secret);

      const result = await service.enable(1, code);

      expect(result.backupCodes).toHaveLength(10);
      expect(userRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ mfaEnabled: true }),
      );
    });

    it('throws for an incorrect code (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 1,
        email: 'a@x.com',
        mfaSecret: encryptMfaSecret('JBSWY3DPEHPK3PXP'),
      });
      await expect(service.enable(1, '000000')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when setup was never started (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 1,
        email: 'a@x.com',
        mfaSecret: null,
      });
      await expect(service.enable(1, '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('disable', () => {
    it('clears MFA state after confirming the password (positive)', async () => {
      userRepo.findOne.mockResolvedValue({ id: 1, passwordHash: 'hash' });

      await service.disable(1, 'correct-password');

      expect(userRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ mfaEnabled: false, mfaSecret: null }),
      );
    });

    it('throws for the wrong password (negative)', async () => {
      const bcrypt = jest.requireMock('bcrypt') as { compare: jest.Mock };
      bcrypt.compare.mockResolvedValueOnce(false);
      userRepo.findOne.mockResolvedValue({ id: 1, passwordHash: 'hash' });

      await expect(service.disable(1, 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyLoginCode', () => {
    const secret = 'JBSWY3DPEHPK3PXP';

    it('accepts a valid TOTP code (positive)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 1,
        mfaEnabled: true,
        mfaSecret: encryptMfaSecret(secret),
        mfaBackupCodes: [],
      });

      const user = await service.verifyLoginCode(
        1,
        authenticator.generate(secret),
      );
      expect(user.id).toBe(1);
    });

    it('accepts and consumes a valid backup code when the TOTP code is wrong (positive)', async () => {
      const backupCodes = generateBackupCodes(3);
      userRepo.findOne.mockResolvedValue({
        id: 1,
        mfaEnabled: true,
        mfaSecret: encryptMfaSecret(secret),
        mfaBackupCodes: backupCodes.map(hashBackupCode),
      });

      await service.verifyLoginCode(1, backupCodes[0]);

      expect(userRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          mfaBackupCodes: expect.arrayContaining([
            hashBackupCode(backupCodes[1]),
          ]),
        }),
      );
    });

    it('throws for an invalid TOTP code and an unknown backup code (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 1,
        mfaEnabled: true,
        mfaSecret: encryptMfaSecret(secret),
        mfaBackupCodes: [],
      });

      await expect(service.verifyLoginCode(1, '000000')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when MFA is not enabled on the account (negative)', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 1,
        mfaEnabled: false,
        mfaSecret: null,
      });
      await expect(service.verifyLoginCode(1, '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
