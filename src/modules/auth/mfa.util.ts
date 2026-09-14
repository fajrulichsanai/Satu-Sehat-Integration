import { authenticator } from 'otplib';
import * as crypto from 'crypto';
import { encrypt, decrypt } from '../../common/utils/crypto.util';

const APP_NAME = 'ApexRecord';
const BACKUP_CODE_COUNT = 10;

function getKey(): string {
  const key = process.env.MFA_ENCRYPTION_KEY;
  if (!key) {
    throw new Error('MFA_ENCRYPTION_KEY environment variable is required');
  }
  return key;
}

export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

export function encryptMfaSecret(secret: string): string {
  return encrypt(secret, getKey());
}

export function decryptMfaSecret(encrypted: string): string {
  return decrypt(encrypted, getKey());
}

export function buildOtpauthUrl(secret: string, email: string): string {
  return authenticator.keyuri(email, APP_NAME, secret);
}

export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    // authenticator.verify throws on a malformed token/secret rather than
    // returning false, so a bad user-supplied code must still be caught here.
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/** Plain backup codes to show the user once, e.g. "A1B2-C3D4". */
export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 hex chars
    return `${raw.slice(0, 5)}-${raw.slice(5, 10)}`;
  });
}

export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');
}

/**
 * Checks `code` against the list of still-unused hashed codes and returns
 * the remaining list with the matched one removed (each backup code is
 * single-use), or null if no hash matched.
 */
export function consumeBackupCode(
  code: string,
  hashedCodes: string[],
): string[] | null {
  const hash = hashBackupCode(code);
  const index = hashedCodes.indexOf(hash);
  if (index === -1) return null;
  return [...hashedCodes.slice(0, index), ...hashedCodes.slice(index + 1)];
}
