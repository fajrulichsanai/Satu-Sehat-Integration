import * as crypto from 'crypto';
import { encrypt, decrypt } from '../../common/utils/crypto.util';

/**
 * NIK (and mother's NIK) is sensitive PII and must never be stored in
 * plaintext. It's also used for exact-match search and per-clinic duplicate
 * prevention, which a randomized cipher (see crypto.util) can't support —
 * the same plaintext encrypts to a different ciphertext every time. So the
 * value is stored twice: `nik` holds the encrypted value (decrypted only for
 * display), and `nikHash` holds a deterministic HMAC-SHA256 "blind index"
 * used purely for equality lookups. The hash can't be reversed back to a NIK.
 */
function getKey(): string {
  const key = process.env.PATIENT_DATA_ENCRYPTION_KEY;
  if (!key) {
    throw new Error(
      'PATIENT_DATA_ENCRYPTION_KEY environment variable is required',
    );
  }
  return key;
}

export function encryptNik(value: string): string {
  return encrypt(value, getKey());
}

export function decryptNik(value: string): string {
  return decrypt(value, getKey());
}

export function hashNik(value: string): string {
  return crypto.createHmac('sha256', getKey()).update(value).digest('hex');
}

/** For logging only — never write a full NIK to application logs. */
export function maskNik(value?: string | null): string {
  if (!value) return '-';
  return value.length <= 4 ? '***' : `***${value.slice(-4)}`;
}

/** TypeORM column transformer: encrypts on write, decrypts on read. */
export const nikColumnTransformer = {
  to(value?: string | null): string | null {
    if (value === null || value === undefined || value === '') {
      return value ?? null;
    }
    return encryptNik(value);
  },
  from(value?: string | null): string | null {
    if (value === null || value === undefined || value === '') {
      return value ?? null;
    }
    return decryptNik(value);
  },
};
