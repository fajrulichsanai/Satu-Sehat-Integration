/**
 * Riwayat pengobatan pasien — obat yang sedang/pernah dikonsumsi di luar
 * resep kunjungan ini (FHIR MedicationStatement, Playbook "Riwayat
 * Pengobatan"). Disimpan per pasien seperti riwayat alergi.
 */
export interface MedicationHistoryEntry {
  /** Kunci tetap per baris — dipakai untuk menautkan resource SATUSEHAT */
  key: string;
  /** Kode produk KFA (92…/93…); tanpa kode baris hanya disimpan, tidak dikirim */
  kfaCode: string | null;
  name: string;
  /** Aturan pakai bebas, mis. "1 tablet sekali sehari" */
  dosage: string | null;
  /** true = masih dikonsumsi (active), false = sudah berhenti (completed) */
  active: boolean;
  /** Dihapus setelah terkirim: dikirim sebagai entered-in-error lalu dibuang */
  removed?: boolean;
}

/** Kode produk KFA yang bisa dipakai di medicationCodeableConcept */
export const KFA_PRODUCT_CODE = /^9[23]\d{6}$/;

export const medicationHistoryLinkType = (key: string) => `pt_medst_${key}`;
