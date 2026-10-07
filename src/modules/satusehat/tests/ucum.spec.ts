import { readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';
import { toUcum } from '../fhir/ucum';

const load = (file: string) =>
  JSON.parse(
    gunzipSync(
      readFileSync(join(__dirname, '../../../../data/terminology', file)),
    ).toString('utf8'),
  ) as { tests: { unit: string | null }[] };

describe('toUcum', () => {
  it('maps Indonesian / display units to UCUM codes (positive)', () => {
    expect(toUcum('detik')).toBe('s');
    expect(toUcum('mg/24 jam')).toBe('mg/(24.h)');
    expect(toUcum('10^3/µL')).toBe('10*3/uL');
    expect(toUcum('µg/L')).toBe('ug/L');
    expect(toUcum('IU/mL')).toBe('[IU]/mL');
    expect(toUcum('Indeks')).toBe('{index}');
    expect(toUcum('mg/dL')).toBe('mg/dL');
  });

  it('every unit in the bundled lab & radiology catalogs has a UCUM code (edge)', () => {
    // Semua kode hasil pemetaan sudah divalidasi dengan @lhncbc/ucum-lhc.
    const units = new Set(
      [...load('loinc-lab.json.gz').tests, ...load('loinc-rad.json.gz').tests]
        .map((t) => t.unit)
        .filter((u): u is string => !!u),
    );
    expect(units.size).toBeGreaterThan(50);
    expect([...units].filter((u) => !toUcum(u))).toEqual([]);
  });

  it('returns null for empty or unknown units so they go out as text only (negative)', () => {
    expect(toUcum(null)).toBeNull();
    expect(toUcum('  ')).toBeNull();
    expect(toUcum('satuan aneh')).toBeNull();
  });
});
