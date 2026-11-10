import { Injectable, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { gunzipSync } from 'zlib';

/**
 * Katalog pemeriksaan resmi SATUSEHAT yang dibundel di data/terminology:
 *  - loinc-lab.json.gz  : Terminologi LOINC Laboratorium v1.1 (+ answer list)
 *  - loinc-rad.json.gz  : Terminologi LOINC Radiologi v1.0 + Radiologi Gigi
 *  - diet-types.json.gz : Lampiran NutritionOrder.oralDiet.type (SNOMED + Kemkes)
 * Kecil (ribuan baris), jadi dimuat sekali ke memori.
 */

export interface LabTest {
  category: string | null;
  /** Nama pemeriksaan (Bahasa Indonesia) */
  name: string | null;
  /** "Permintaan" | "Hasil" | "Permintaan & Hasil" */
  use: string | null;
  specimen: string | null;
  /** Quantitative | Ordinal | Nominal | OrdQn | Narrative */
  scale: string | null;
  unit: string | null;
  method: string | null;
  code: string;
  display: string | null;
  system: string;
}

export interface RadiologyTest {
  category: string | null;
  name: string | null;
  use: string | null;
  code: string;
  display: string | null;
  system: string;
  unit: string | null;
  bodySite: { code: string; display: string } | null;
}

export interface CodedAnswer {
  code: string;
  display: string;
  system: string;
}

export interface DietType {
  system: string;
  code: string;
  display: string;
}

const DATA_DIR = resolve(__dirname, '../../../data/terminology');

function load<T>(file: string): T {
  return JSON.parse(
    gunzipSync(readFileSync(resolve(DATA_DIR, file))).toString('utf8'),
  ) as T;
}

/** Semua kata kunci harus muncul (urutan bebas), tanpa beda huruf besar. */
function matcher(q: string) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6);
  return (...fields: (string | null | undefined)[]) => {
    const hay = fields.filter(Boolean).join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  };
}

@Injectable()
export class ClinicalCatalogService {
  private lab?: { tests: LabTest[]; answers: Record<string, CodedAnswer[]> };
  private rad?: { tests: RadiologyTest[] };
  private diet?: { types: DietType[] };

  private labData() {
    return (this.lab ??= load('loinc-lab.json.gz'));
  }
  private radData() {
    return (this.rad ??= load('loinc-rad.json.gz'));
  }
  private dietData() {
    return (this.diet ??= load('diet-types.json.gz'));
  }

  /**
   * Pemeriksaan lab. `use=request` → boleh di ServiceRequest (Permintaan /
   * Permintaan & Hasil), `use=result` → boleh di Observation (Hasil / P&H).
   */
  searchLab(q: string, use?: 'request' | 'result', limit = 20): LabTest[] {
    const match = matcher(q ?? '');
    return this.labData()
      .tests.filter((t) => this.labUseOk(t, use))
      .filter((t) => match(t.name, t.display, t.code, t.category, t.specimen))
      .slice(0, limit);
  }

  getLab(code: string): LabTest & { answers: CodedAnswer[] } {
    const test = this.labData().tests.find((t) => t.code === code);
    if (!test)
      throw new NotFoundException(`Kode lab ${code} tidak ada di katalog`);
    return { ...test, answers: this.labData().answers[code] ?? [] };
  }

  /** Parameter hasil dalam kategori & nama pemeriksaan yang sama (panel). */
  labResultsFor(code: string): LabTest[] {
    const req = this.getLab(code);
    return this.labData().tests.filter(
      (t) =>
        t.name === req.name &&
        t.category === req.category &&
        this.labUseOk(t, 'result'),
    );
  }

  searchRadiology(
    q: string,
    opts: { dental?: boolean; use?: 'request' | 'result' } = {},
    limit = 20,
  ): RadiologyTest[] {
    const match = matcher(q ?? '');
    return this.radData()
      .tests.filter((t) =>
        opts.dental === undefined
          ? true
          : opts.dental === (t.category === 'Radiologi Gigi'),
      )
      .filter((t) => this.labUseOk(t, opts.use))
      .filter((t) => match(t.name, t.display, t.code))
      .slice(0, limit);
  }

  getRadiology(code: string): RadiologyTest {
    const test = this.radData().tests.find((t) => t.code === code);
    if (!test)
      throw new NotFoundException(
        `Kode radiologi ${code} tidak ada di katalog`,
      );
    return test;
  }

  searchDiet(q: string, limit = 20): DietType[] {
    const match = matcher(q ?? '');
    // Kode Kemkes (bahasa Indonesia) di urutan atas
    return [...this.dietData().types]
      .sort(
        (a, b) =>
          Number(b.code.startsWith('OV')) - Number(a.code.startsWith('OV')),
      )
      .filter((t) => match(t.display, t.code))
      .slice(0, limit);
  }

  getDiet(code: string): DietType {
    const t = this.dietData().types.find((d) => d.code === code);
    if (!t) throw new NotFoundException(`Kode diet ${code} tidak dikenal`);
    return t;
  }

  private labUseOk(t: { use: string | null }, use?: 'request' | 'result') {
    if (!use) return true;
    const u = (t.use ?? '').toLowerCase();
    return use === 'request' ? u.includes('permintaan') : u.includes('hasil');
  }
}
