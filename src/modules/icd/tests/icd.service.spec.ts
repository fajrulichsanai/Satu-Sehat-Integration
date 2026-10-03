import { IcdService } from '../icd.service';
import { ICD10_DATA } from '../data/icd10.data';
import { ICD9_DATA } from '../data/icd9.data';

describe('IcdService', () => {
  let service: IcdService;

  beforeEach(() => {
    service = new IcdService();
  });

  describe('searchIcd10', () => {
    it('matches by code case-insensitively (positive)', () => {
      const result = service.searchIcd10('k00.0');
      expect(result).toEqual(
        expect.arrayContaining([{ code: 'K00.0', display: 'Anodontia' }]),
      );
    });

    it('matches by display text (positive)', () => {
      const result = service.searchIcd10('anodontia');
      expect(result.some((r) => r.code === 'K00.0')).toBe(true);
    });

    it('returns an empty array for an empty query (negative/edge)', () => {
      expect(service.searchIcd10('')).toEqual([]);
    });

    it('returns an empty array for a whitespace-only query (negative/edge)', () => {
      expect(service.searchIcd10('   ')).toEqual([]);
    });

    it('returns an empty array when nothing matches (negative)', () => {
      expect(service.searchIcd10('zzzznonexistentcode')).toEqual([]);
    });

    it('caps results at the requested limit (positive)', () => {
      const result = service.searchIcd10('k', 3);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('hard-caps results at 50 even when a larger limit is requested (edge)', () => {
      const result = service.searchIcd10('k', 1000);
      expect(result.length).toBeLessThanOrEqual(50);
    });

    it('defaults to a limit of 25 when none is given (edge)', () => {
      const result = service.searchIcd10('k');
      expect(result.length).toBeLessThanOrEqual(25);
    });
  });

  describe('searchIcd9', () => {
    it('matches ICD-9 entries by code or display (positive)', () => {
      const sample = ICD9_DATA[0];
      const result = service.searchIcd9(sample.code);
      expect(result.some((r) => r.code === sample.code)).toBe(true);
    });

    it('returns an empty array for an empty query (negative/edge)', () => {
      expect(service.searchIcd9('')).toEqual([]);
    });

    it('does not leak ICD-10-only entries into ICD-9 search (negative)', () => {
      const icd10Only = ICD10_DATA.find(
        (i) => !ICD9_DATA.some((j) => j.code === i.code),
      );
      if (icd10Only) {
        const result = service.searchIcd9(icd10Only.code);
        expect(result.find((r) => r.code === icd10Only.code)).toBeUndefined();
      }
    });
  });
});
