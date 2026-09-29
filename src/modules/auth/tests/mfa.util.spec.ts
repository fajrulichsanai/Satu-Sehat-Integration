process.env.MFA_ENCRYPTION_KEY = 'test-mfa-key-not-for-production';

import { authenticator } from 'otplib';
import {
  generateMfaSecret,
  encryptMfaSecret,
  decryptMfaSecret,
  buildOtpauthUrl,
  verifyTotpToken,
  generateBackupCodes,
  hashBackupCode,
  consumeBackupCode,
} from '../mfa.util';

describe('mfa.util', () => {
  describe('encryptMfaSecret / decryptMfaSecret', () => {
    it('round-trips a secret (positive)', () => {
      const secret = generateMfaSecret();
      expect(decryptMfaSecret(encryptMfaSecret(secret))).toBe(secret);
    });
  });

  describe('buildOtpauthUrl', () => {
    it('embeds the account and issuer (positive)', () => {
      const secret = generateMfaSecret();
      const url = buildOtpauthUrl(secret, 'user@example.com');
      expect(url).toContain('otpauth://totp/');
      expect(url).toContain('ApexRecord');
      expect(url).toContain(encodeURIComponent('user@example.com'));
    });
  });

  describe('verifyTotpToken', () => {
    it('accepts the current valid code (positive)', () => {
      const secret = generateMfaSecret();
      const token = authenticator.generate(secret);
      expect(verifyTotpToken(token, secret)).toBe(true);
    });

    it('rejects an incorrect code (negative)', () => {
      const secret = generateMfaSecret();
      expect(verifyTotpToken('000000', secret)).toBe(false);
    });

    it('rejects a malformed token instead of throwing (negative/edge)', () => {
      const secret = generateMfaSecret();
      expect(verifyTotpToken('not-a-code', secret)).toBe(false);
    });
  });

  describe('backup codes', () => {
    it('generates the requested number of unique codes (positive)', () => {
      const codes = generateBackupCodes(10);
      expect(codes).toHaveLength(10);
      expect(new Set(codes).size).toBe(10);
    });

    it('consumeBackupCode removes only the matched code, single-use (positive)', () => {
      const codes = generateBackupCodes(3);
      const hashed = codes.map(hashBackupCode);

      const remaining = consumeBackupCode(codes[1], hashed);

      expect(remaining).toHaveLength(2);
      expect(remaining).not.toContain(hashed[1]);
      // Using the same code again against the already-updated list fails.
      expect(consumeBackupCode(codes[1], remaining!)).toBeNull();
    });

    it('is case-insensitive (positive/edge)', () => {
      const codes = generateBackupCodes(1);
      const hashed = codes.map(hashBackupCode);
      expect(consumeBackupCode(codes[0].toLowerCase(), hashed)).toEqual([]);
    });

    it('returns null for a code that was never issued (negative)', () => {
      const hashed = generateBackupCodes(3).map(hashBackupCode);
      expect(consumeBackupCode('ZZZZZ-ZZZZZ', hashed)).toBeNull();
    });
  });

  describe('missing MFA_ENCRYPTION_KEY', () => {
    it('throws instead of silently using a default key (negative)', () => {
      const original = process.env.MFA_ENCRYPTION_KEY;
      delete process.env.MFA_ENCRYPTION_KEY;
      try {
        expect(() => encryptMfaSecret('x')).toThrow(
          'MFA_ENCRYPTION_KEY environment variable is required',
        );
      } finally {
        process.env.MFA_ENCRYPTION_KEY = original;
      }
    });
  });
});
