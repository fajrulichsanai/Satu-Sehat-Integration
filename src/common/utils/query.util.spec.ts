import { parseLimit } from './query.util';

describe('parseLimit', () => {
  it('parses a valid limit (positive)', () => {
    expect(parseLimit('25')).toBe(25);
  });

  it('caps a limit above the maximum (edge)', () => {
    expect(parseLimit('999999')).toBe(100);
    expect(parseLimit('80', 50)).toBe(50);
  });

  it('returns undefined for missing, non-numeric, zero or negative values so the default applies (negative)', () => {
    for (const raw of [undefined, '', 'abc', '0', '-5']) {
      expect(parseLimit(raw)).toBeUndefined();
    }
  });
});
