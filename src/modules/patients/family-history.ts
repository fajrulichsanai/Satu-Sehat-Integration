/**
 * Riwayat penyakit keluarga (FHIR FamilyMemberHistory) & wali pasien
 * (FHIR RelatedPerson). Hubungan memakai v3-RoleCode HL7 sesuai spesifikasi
 * SATUSEHAT; kondisi memakai ICD-10.
 */
export const ROLE_CODE_SYSTEM =
  'http://terminology.hl7.org/CodeSystem/v3-RoleCode';

export const FAMILY_RELATIONSHIPS = {
  FTH: { display: 'father', label: 'Ayah' },
  MTH: { display: 'mother', label: 'Ibu' },
  BRO: { display: 'brother', label: 'Saudara laki-laki' },
  SIS: { display: 'sister', label: 'Saudara perempuan' },
  GRFTH: { display: 'grandfather', label: 'Kakek' },
  GRMTH: { display: 'grandmother', label: 'Nenek' },
  SON: { display: 'natural son', label: 'Anak laki-laki' },
  DAU: { display: 'natural daughter', label: 'Anak perempuan' },
  UNCLE: { display: 'uncle', label: 'Paman' },
  AUNT: { display: 'aunt', label: 'Bibi' },
  COUSN: { display: 'cousin', label: 'Sepupu' },
  FAMMEMB: { display: 'family member', label: 'Anggota keluarga lain' },
} as const;
export type FamilyRelationship = keyof typeof FAMILY_RELATIONSHIPS;
export const FAMILY_RELATIONSHIP_CODES = Object.keys(
  FAMILY_RELATIONSHIPS,
) as FamilyRelationship[];

/** Wali pasien (patients.hubungan_wali) → v3-RoleCode */
export const GUARDIAN_ROLE: Record<string, { code: string; display: string }> =
  {
    ibu: { code: 'MTH', display: 'mother' },
    ayah: { code: 'FTH', display: 'father' },
    wali: { code: 'GUARD', display: 'guardian' },
  };

/** Satu baris riwayat keluarga di patients.riwayat_keluarga (JSON) */
export interface FamilyHistoryEntry {
  /** Kunci tetap per baris — dipakai untuk menautkan resource SATUSEHAT */
  key: string;
  relationship: FamilyRelationship;
  code: string;
  display: string;
  nameId: string | null;
  note: string | null;
  /** Dihapus setelah terkirim: dikirim sebagai entered-in-error lalu dibuang */
  removed?: boolean;
}

export const familyHistoryLinkType = (key: string) => `pt_fmh_${key}`;
