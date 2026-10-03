import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import { join } from 'path';
import { CURATED_DIAGNOSES, ICD10_CHAPTERS } from '../data/dental-id';

function load(system: 'icd10' | 'snomed'): Map<string, string> {
  const text = gunzipSync(
    readFileSync(
      join(__dirname, '../../../../data/terminology', `${system}.tsv.gz`),
    ),
  ).toString('utf8');
  return new Map(
    text
      .split('\n')
      .filter(Boolean)
      .map(
        (l) =>
          [l.slice(0, l.indexOf('\t')), l.slice(l.indexOf('\t') + 1)] as [
            string,
            string,
          ],
      ),
  );
}

describe('Indonesian dental diagnosis list', () => {
  const icd10 = load('icd10');
  const snomed = load('snomed');

  it('only uses codes that exist in the bundled ICD-10 and SNOMED data (positive)', () => {
    expect(icd10.size).toBe(18543);
    expect(snomed.size).toBe(499592);
    for (const d of CURATED_DIAGNOSES) {
      expect({ code: d.icd10, found: icd10.has(d.icd10) }).toEqual({
        code: d.icd10,
        found: true,
      });
      if (d.snomed)
        expect({ code: d.snomed, found: snomed.has(d.snomed) }).toEqual({
          code: d.snomed,
          found: true,
        });
    }
  });

  it('has no duplicate codes, and every entry has a name and an explanation (negative)', () => {
    const icds = CURATED_DIAGNOSES.map((d) => d.icd10);
    const snos = CURATED_DIAGNOSES.map((d) => d.snomed).filter(Boolean);
    expect(new Set(icds).size).toBe(icds.length);
    expect(new Set(snos).size).toBe(snos.length);
    for (const d of CURATED_DIAGNOSES) {
      expect(d.nameId.length).toBeGreaterThan(3);
      expect(d.explanation.length).toBeGreaterThan(20);
    }
  });

  it('places every ICD-10 category in a chapter (edge)', () => {
    const categories = [
      ...new Set([...icd10.keys()].map((c) => c.slice(0, 3))),
    ];
    const orphan = categories.filter(
      (c) => !ICD10_CHAPTERS.some((ch) => c >= ch.from && c <= ch.to),
    );
    expect(orphan).toEqual([]);
  });
});
