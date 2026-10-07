/**
 * Kode terkontrol modul Kondisi (Condition) & Observasi (Observation).
 *
 * Semua kode di sini tetap (bukan ketikan bebas) supaya resource yang
 * dikirim ke SATUSEHAT selalu valid: sistem, kode, display, kategori dan
 * satuan UCUM sudah pasti benar. Kode lab diambil dari Terminologi LOINC
 * Laboratorium SATUSEHAT (data/terminology/loinc-lab.json.gz) — dicek di
 * unit test.
 */

// ── Condition ────────────────────────────────────────────────────────────

export const CLINICAL_STATUSES = {
  active: { display: 'Active', label: 'Aktif' },
  recurrence: { display: 'Recurrence', label: 'Kambuh (muncul lagi)' },
  relapse: { display: 'Relapse', label: 'Relaps' },
  inactive: { display: 'Inactive', label: 'Tidak aktif' },
  remission: { display: 'Remission', label: 'Remisi' },
  resolved: { display: 'Resolved', label: 'Sembuh / selesai' },
} as const;
export type ClinicalStatus = keyof typeof CLINICAL_STATUSES;
export const CLINICAL_STATUS_KEYS = Object.keys(
  CLINICAL_STATUSES,
) as ClinicalStatus[];
/** Status yang boleh punya tanggal berakhir (FHIR con-4) */
export const ABATED_STATUSES: ClinicalStatus[] = [
  'inactive',
  'remission',
  'resolved',
];

export const VERIFICATION_STATUSES = {
  confirmed: { display: 'Confirmed', label: 'Pasti' },
  provisional: { display: 'Provisional', label: 'Sementara' },
  differential: { display: 'Differential', label: 'Diagnosis banding' },
  unconfirmed: { display: 'Unconfirmed', label: 'Belum dipastikan' },
  refuted: { display: 'Refuted', label: 'Tidak terbukti' },
} as const;
export type VerificationStatus = keyof typeof VERIFICATION_STATUSES;
export const VERIFICATION_STATUS_KEYS = Object.keys(
  VERIFICATION_STATUSES,
) as VerificationStatus[];
/** Penanda "dihapus" untuk data yang sudah terkirim */
export const ENTERED_IN_ERROR = 'entered-in-error';

export const CONDITION_SEVERITIES = {
  mild: { code: '255604002', display: 'Mild', label: 'Ringan' },
  moderate: { code: '6736007', display: 'Moderate', label: 'Sedang' },
  severe: { code: '24484000', display: 'Severe', label: 'Berat' },
} as const;
export type ConditionSeverity = keyof typeof CONDITION_SEVERITIES;
export const CONDITION_SEVERITY_KEYS = Object.keys(
  CONDITION_SEVERITIES,
) as ConditionSeverity[];

// ── Observation ──────────────────────────────────────────────────────────

export const OBSERVATION_CATEGORIES = {
  'vital-signs': 'Vital Signs',
  exam: 'Exam',
  survey: 'Survey',
  laboratory: 'Laboratory',
  'social-history': 'Social History',
} as const;
export type ObservationCategory = keyof typeof OBSERVATION_CATEGORIES;

export interface ObservationAnswer {
  /** SNOMED CT */
  code: string;
  display: string;
  label: string;
}

export interface ObservationDef {
  key: string;
  label: string;
  group: string;
  category: ObservationCategory;
  loinc: string;
  display: string;
  kind: 'quantity' | 'coded';
  /** Satuan tampilan & kode UCUM (kind = quantity) */
  unit?: string;
  ucum?: string;
  min?: number;
  max?: number;
  decimals?: number;
  answers?: ObservationAnswer[];
  hint?: string;
}

export const OBSERVATION_CATALOG: ObservationDef[] = [
  {
    key: 'bmi',
    label: 'Indeks Massa Tubuh (IMT)',
    group: 'Antropometri',
    category: 'vital-signs',
    loinc: '39156-5',
    display: 'Body mass index (BMI) [Ratio]',
    kind: 'quantity',
    unit: 'kg/m²',
    ucum: 'kg/m2',
    min: 5,
    max: 80,
    decimals: 1,
    hint: 'Dihitung otomatis dari tinggi & berat badan bila tersedia',
  },
  {
    key: 'head-circumference',
    label: 'Lingkar kepala',
    group: 'Antropometri',
    category: 'vital-signs',
    loinc: '9843-4',
    display: 'Head Occipital-frontal circumference',
    kind: 'quantity',
    unit: 'cm',
    ucum: 'cm',
    min: 20,
    max: 70,
    decimals: 1,
  },
  {
    key: 'waist-circumference',
    label: 'Lingkar perut',
    group: 'Antropometri',
    category: 'exam',
    loinc: '8280-0',
    display: 'Waist Circumference at umbilicus by Tape measure',
    kind: 'quantity',
    unit: 'cm',
    ucum: 'cm',
    min: 30,
    max: 250,
    decimals: 1,
  },
  {
    key: 'gcs',
    label: 'Glasgow Coma Scale (GCS) total',
    group: 'Neurologi',
    category: 'survey',
    loinc: '9269-2',
    display: 'Glasgow coma score total',
    kind: 'quantity',
    unit: 'skor',
    ucum: '{score}',
    min: 3,
    max: 15,
    decimals: 0,
  },
  {
    key: 'smoking',
    label: 'Status merokok',
    group: 'Gaya hidup',
    category: 'social-history',
    loinc: '72166-2',
    display: 'Tobacco smoking status',
    kind: 'coded',
    answers: [
      {
        code: '266919005',
        display: 'Never smoked',
        label: 'Tidak pernah merokok',
      },
      { code: '8517006', display: 'Former smoker', label: 'Mantan perokok' },
      {
        code: '428041000124106',
        display: 'Occasional tobacco smoker',
        label: 'Kadang-kadang merokok',
      },
      {
        code: '449868002',
        display: 'Smokes tobacco daily',
        label: 'Merokok setiap hari',
      },
    ],
  },
  {
    key: 'glucose-poct',
    label: 'Gula darah sewaktu (glukometer)',
    group: 'Pemeriksaan cepat (POCT)',
    category: 'laboratory',
    loinc: '41653-7',
    display: 'Glucose [Mass/volume] in Capillary blood by Glucometer',
    kind: 'quantity',
    unit: 'mg/dL',
    ucum: 'mg/dL',
    min: 10,
    max: 1000,
    decimals: 0,
  },
  {
    key: 'glucose-fasting',
    label: 'Gula darah puasa',
    group: 'Pemeriksaan cepat (POCT)',
    category: 'laboratory',
    loinc: '1558-6',
    display: 'Fasting glucose [Mass/volume] in Serum or Plasma',
    kind: 'quantity',
    unit: 'mg/dL',
    ucum: 'mg/dL',
    min: 10,
    max: 1000,
    decimals: 0,
  },
  {
    key: 'cholesterol',
    label: 'Kolesterol total',
    group: 'Pemeriksaan cepat (POCT)',
    category: 'laboratory',
    loinc: '2093-3',
    display: 'Cholesterol [Mass/volume] in Serum or Plasma',
    kind: 'quantity',
    unit: 'mg/dL',
    ucum: 'mg/dL',
    min: 30,
    max: 1000,
    decimals: 0,
  },
  {
    key: 'uric-acid',
    label: 'Asam urat',
    group: 'Pemeriksaan cepat (POCT)',
    category: 'laboratory',
    loinc: '3084-1',
    display: 'Urate [Mass/volume] in Serum or Plasma',
    kind: 'quantity',
    unit: 'mg/dL',
    ucum: 'mg/dL',
    min: 0.5,
    max: 30,
    decimals: 1,
  },
  {
    key: 'hemoglobin',
    label: 'Hemoglobin (Hb)',
    group: 'Pemeriksaan cepat (POCT)',
    category: 'laboratory',
    loinc: '718-7',
    display: 'Hemoglobin [Mass/volume] in Blood',
    kind: 'quantity',
    unit: 'g/dL',
    ucum: 'g/dL',
    min: 1,
    max: 25,
    decimals: 1,
  },
  {
    key: 'hba1c',
    label: 'HbA1c',
    group: 'Pemeriksaan cepat (POCT)',
    category: 'laboratory',
    loinc: '4548-4',
    display: 'Hemoglobin A1c/Hemoglobin.total in Blood',
    kind: 'quantity',
    unit: '%',
    ucum: '%',
    min: 2,
    max: 20,
    decimals: 1,
  },
];

export const OBSERVATION_BY_KEY = new Map(
  OBSERVATION_CATALOG.map((d) => [d.key, d]),
);
