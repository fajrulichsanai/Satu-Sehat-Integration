/**
 * FDI/ISO 3950 tooth numbers this odontogram supports: 32 permanent teeth
 * (11-18, 21-28, 31-38, 41-48) plus 20 deciduous/primary teeth (51-55,
 * 61-65, 71-75, 81-85) — 52 in total, matching the Kemenkes-aligned
 * reference implementation this module is based on.
 */
export const PERMANENT_TEETH: number[] = [
  11, 12, 13, 14, 15, 16, 17, 18, 21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33,
  34, 35, 36, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48,
];

export const DECIDUOUS_TEETH: number[] = [
  51, 52, 53, 54, 55, 61, 62, 63, 64, 65, 71, 72, 73, 74, 75, 81, 82, 83, 84,
  85,
];

export const ALL_TEETH: number[] = [...PERMANENT_TEETH, ...DECIDUOUS_TEETH];

/** Annotation shown above the tooth: sound, attrition, partially erupted, unerupted, anomaly, non-vital. */
export const TEKS_ATAS_VALUES = [
  'SOU',
  'ATT',
  'PRE',
  'UNE',
  'ANO',
  'NON',
] as const;

/** Annotation shown below the tooth: missing, crown fracture, retained root. */
export const TEKS_BAWAH_VALUES = ['MISSING', 'CFR', 'RRX'] as const;

/** Per-surface finding: caries, composite filling, glass-ionomer filling. */
export const SURFACE_CONDITION_VALUES = ['karies', 'komposit', 'gic'] as const;

export function isValidToothNumber(toothNumber: number): boolean {
  return ALL_TEETH.includes(toothNumber);
}
