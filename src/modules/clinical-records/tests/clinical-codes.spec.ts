import { readFileSync } from 'fs';
import { resolve } from 'path';
import { gunzipSync } from 'zlib';
import { CONDITION_SEVERITIES, OBSERVATION_CATALOG } from '../clinical-codes';

/**
 * Katalog observasi harus cocok dengan terminologi resmi yang dibundel,
 * supaya SATUSEHAT tidak menolak kode / display / satuan.
 */
describe('clinical codes', () => {
  const dataDir = resolve(__dirname, '../../../../data/terminology');
  const lab = JSON.parse(
    gunzipSync(readFileSync(resolve(dataDir, 'loinc-lab.json.gz'))).toString(
      'utf8',
    ),
  ) as { tests: { code: string; display: string; unit: string | null }[] };
  const snomed = new Map(
    gunzipSync(readFileSync(resolve(dataDir, 'snomed.tsv.gz')))
      .toString('utf8')
      .split('\n')
      .map((l) => l.split('\t'))
      .map(([code, display]) => [code, display] as const),
  );

  it('laboratory observations use the official SATUSEHAT LOINC code, display and unit (positive)', () => {
    for (const def of OBSERVATION_CATALOG.filter(
      (d) => d.category === 'laboratory',
    )) {
      const row = lab.tests.find((t) => t.code === def.loinc);
      expect(row).toBeDefined();
      expect(row!.display).toBe(def.display);
      expect(row!.unit).toBe(def.unit);
    }
  });

  it('every coded answer and severity is a known SNOMED concept with the same name (positive)', () => {
    const codings = [
      ...OBSERVATION_CATALOG.flatMap((d) => d.answers ?? []),
      ...Object.values(CONDITION_SEVERITIES),
    ];
    for (const c of codings) expect(snomed.get(c.code)).toBe(c.display);
  });

  it('every quantity has a UCUM code and a sensible range (edge)', () => {
    for (const def of OBSERVATION_CATALOG.filter(
      (d) => d.kind === 'quantity',
    )) {
      expect(def.ucum).toMatch(/^[A-Za-z0-9/%{}[\].]+$/);
      expect(def.min).toBeLessThan(def.max!);
      expect(def.loinc).toMatch(/^\d+-\d$/);
    }
    const keys = OBSERVATION_CATALOG.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
