process.env.PATIENT_DATA_ENCRYPTION_KEY = 'test-key-not-for-production';

import {
  encryptNik,
  decryptNik,
  hashNik,
  maskNik,
  nikColumnTransformer,
} from '../nik-crypto.util';

describe('nik-crypto.util', () => {
  describe('encryptNik / decryptNik', () => {
    it('round-trips a NIK through encryption (positive)', () => {
      const nik = '3201012312310001';
      expect(decryptNik(encryptNik(nik))).toBe(nik);
    });

    it('produces a different ciphertext each time for the same NIK (positive)', () => {
      const nik = '3201012312310001';
      expect(encryptNik(nik)).not.toBe(encryptNik(nik));
    });
  });

  describe('hashNik', () => {
    it('is deterministic for the same NIK (positive)', () => {
      expect(hashNik('3201012312310001')).toBe(hashNik('3201012312310001'));
    });

    it('differs for different NIKs (positive)', () => {
      expect(hashNik('3201012312310001')).not.toBe(hashNik('3201012312310002'));
    });
  });

  describe('maskNik', () => {
    it('keeps only the last 4 digits (positive)', () => {
      expect(maskNik('3201012312310001')).toBe('***0001');
    });

    it('returns a placeholder for empty/null (negative/edge)', () => {
      expect(maskNik(null)).toBe('-');
      expect(maskNik(undefined)).toBe('-');
      expect(maskNik('')).toBe('-');
    });
  });

  describe('nikColumnTransformer', () => {
    it('round-trips through to()/from() (positive)', () => {
      const nik = '3201012312310001';
      expect(nikColumnTransformer.from(nikColumnTransformer.to(nik))).toBe(nik);
    });

    it('passes null/empty through untouched (negative/edge)', () => {
      expect(nikColumnTransformer.to(null)).toBeNull();
      expect(nikColumnTransformer.to(undefined)).toBeNull();
      expect(nikColumnTransformer.from(null)).toBeNull();
    });
  });

  describe('missing PATIENT_DATA_ENCRYPTION_KEY', () => {
    it('throws instead of silently using a default key (negative)', () => {
      const original = process.env.PATIENT_DATA_ENCRYPTION_KEY;
      delete process.env.PATIENT_DATA_ENCRYPTION_KEY;
      try {
        expect(() => hashNik('3201012312310001')).toThrow(
          'PATIENT_DATA_ENCRYPTION_KEY environment variable is required',
        );
      } finally {
        process.env.PATIENT_DATA_ENCRYPTION_KEY = original;
      }
    });
  });
});
