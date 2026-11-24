/**
 * Jenis kontrol di halaman Follow Up Pasien. Satu daftar, empat jenis yang
 * jelas bedanya:
 *  - kunjungan    : kontrol setelah pemeriksaan/kunjungan (dari jadwal kontrol di SOAP)
 *  - behel        : kontrol perawatan ortodonti (behel)
 *  - saluran_akar : kontrol perawatan saluran akar (PSA/pulpektomi)
 *  - perawatan    : kontrol tindakan lain (tambal, cabut, scaling, dst.)
 */
export const RECALL_KINDS = [
  'kunjungan',
  'behel',
  'saluran_akar',
  'perawatan',
] as const;
export type RecallKind = (typeof RECALL_KINDS)[number];

export const RECALL_KIND_LABEL: Record<RecallKind, string> = {
  kunjungan: 'Kontrol kunjungan',
  behel: 'Kontrol behel',
  saluran_akar: 'Kontrol perawatan saluran akar',
  perawatan: 'Kontrol perawatan',
};

/** Jenis kontrol dari nama/kategori tindakan (tarif) yang ditagih. */
export function recallKindForTarif(
  name?: string | null,
  kategori?: string | null,
): RecallKind {
  const text = `${name ?? ''} ${kategori ?? ''}`.toLowerCase();
  if (/behel|bracket|kawat gigi|ortodon|ortho|aligner/.test(text)) {
    return 'behel';
  }
  if (/saluran akar|\bpsa\b|pulpektomi|pulpotomi|endodon/.test(text)) {
    return 'saluran_akar';
  }
  return 'perawatan';
}
