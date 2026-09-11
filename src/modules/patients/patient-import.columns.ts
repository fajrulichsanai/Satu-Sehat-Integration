import {
  BloodType,
  Gender,
  MaritalStatus,
  Rhesus,
} from '../../enums';

/** Raw string values as read from one spreadsheet row, keyed by our internal field name. */
export interface PatientImportRawRow {
  noRm?: string;
  name?: string;
  gender?: string;
  dateOfBirth?: string;
  nik?: string;
  phone?: string;
  email?: string;
  address?: string;
  kelurahan?: string;
  kecamatan?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  pekerjaan?: string;
  maritalStatus?: string;
  golonganDarah?: string;
  rhesus?: string;
  punyaAlergi?: string;
  catatanAlergi?: string;
  riwayatHipertensi?: string;
  riwayatDiabetes?: string;
  riwayatParuParu?: string;
}

export type PatientImportField = keyof PatientImportRawRow;

export interface PatientImportColumn {
  header: string;
  field: PatientImportField;
  required: boolean;
  example: string;
  note?: string;
}

/**
 * Single source of truth for the spreadsheet layout — both the downloadable
 * template and the upload parser are built from this list, so the two can
 * never drift out of sync.
 */
export const PATIENT_IMPORT_COLUMNS: PatientImportColumn[] = [
  { header: 'No RM Lama', field: 'noRm', required: false, example: '00123', note: 'Kosongkan jika ingin nomor RM baru dibuat otomatis' },
  { header: 'Nama Lengkap', field: 'name', required: true, example: 'Budi Santoso' },
  { header: 'Jenis Kelamin', field: 'gender', required: true, example: 'Laki-laki', note: 'Isi: Laki-laki / Perempuan' },
  { header: 'Tanggal Lahir', field: 'dateOfBirth', required: false, example: '1990-05-20', note: 'Format: YYYY-MM-DD' },
  { header: 'NIK', field: 'nik', required: false, example: '3171234567890001', note: '16 digit angka' },
  { header: 'No Telepon', field: 'phone', required: false, example: '081234567890' },
  { header: 'Email', field: 'email', required: false, example: 'budi@email.com' },
  { header: 'Alamat', field: 'address', required: false, example: 'Jl. Merdeka No. 1' },
  { header: 'Kelurahan', field: 'kelurahan', required: false, example: 'Sukasari' },
  { header: 'Kecamatan', field: 'kecamatan', required: false, example: 'Cibeunying' },
  { header: 'Kota', field: 'city', required: false, example: 'Jakarta' },
  { header: 'Provinsi', field: 'province', required: false, example: 'DKI Jakarta' },
  { header: 'Kode Pos', field: 'postalCode', required: false, example: '12345' },
  { header: 'Pekerjaan', field: 'pekerjaan', required: false, example: 'Karyawan Swasta' },
  { header: 'Status Pernikahan', field: 'maritalStatus', required: false, example: 'Menikah', note: 'Isi: Belum Menikah / Menikah / Cerai / Janda-Duda' },
  { header: 'Golongan Darah', field: 'golonganDarah', required: false, example: 'O', note: 'Isi: A / B / AB / O' },
  { header: 'Rhesus', field: 'rhesus', required: false, example: 'Positif', note: 'Isi: Positif / Negatif' },
  { header: 'Punya Alergi', field: 'punyaAlergi', required: false, example: 'Tidak', note: 'Isi: Ya / Tidak' },
  { header: 'Catatan Alergi', field: 'catatanAlergi', required: false, example: '' },
  { header: 'Riwayat Hipertensi', field: 'riwayatHipertensi', required: false, example: 'Tidak', note: 'Isi: Ya / Tidak' },
  { header: 'Riwayat Diabetes', field: 'riwayatDiabetes', required: false, example: 'Tidak', note: 'Isi: Ya / Tidak' },
  { header: 'Riwayat Paru-paru', field: 'riwayatParuParu', required: false, example: 'Tidak', note: 'Isi: Ya / Tidak' },
];

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

const GENDER_LABELS: Record<string, Gender> = {
  'laki-laki': Gender.MALE,
  'laki laki': Gender.MALE,
  laki: Gender.MALE,
  pria: Gender.MALE,
  l: Gender.MALE,
  male: Gender.MALE,
  m: Gender.MALE,
  perempuan: Gender.FEMALE,
  wanita: Gender.FEMALE,
  p: Gender.FEMALE,
  female: Gender.FEMALE,
  f: Gender.FEMALE,
};

const MARITAL_STATUS_LABELS: Record<string, MaritalStatus> = {
  'belum menikah': MaritalStatus.SINGLE,
  lajang: MaritalStatus.SINGLE,
  single: MaritalStatus.SINGLE,
  menikah: MaritalStatus.MARRIED,
  married: MaritalStatus.MARRIED,
  cerai: MaritalStatus.DIVORCED,
  'cerai hidup': MaritalStatus.DIVORCED,
  divorced: MaritalStatus.DIVORCED,
  janda: MaritalStatus.WIDOWED,
  duda: MaritalStatus.WIDOWED,
  'janda-duda': MaritalStatus.WIDOWED,
  'janda/duda': MaritalStatus.WIDOWED,
  'cerai mati': MaritalStatus.WIDOWED,
  widowed: MaritalStatus.WIDOWED,
};

const BLOOD_TYPE_LABELS: Record<string, BloodType> = {
  a: BloodType.A,
  b: BloodType.B,
  ab: BloodType.AB,
  o: BloodType.O,
};

const RHESUS_LABELS: Record<string, Rhesus> = {
  positif: Rhesus.POSITIVE,
  '+': Rhesus.POSITIVE,
  positive: Rhesus.POSITIVE,
  negatif: Rhesus.NEGATIVE,
  '-': Rhesus.NEGATIVE,
  negative: Rhesus.NEGATIVE,
};

const BOOLEAN_LABELS: Record<string, boolean> = {
  ya: true,
  yes: true,
  true: true,
  '1': true,
  tidak: false,
  no: false,
  false: false,
  '0': false,
};

/** Looks up a raw spreadsheet label against a controlled-vocabulary map. Returns
 * undefined for a blank cell (not an error), or throws-by-return-null for an
 * unrecognized non-blank value so the caller can report exactly which cell is bad. */
function lookupLabel<T>(
  raw: string | undefined,
  map: Record<string, T>,
): { value?: T; invalid?: string } {
  if (raw === undefined || raw.trim() === '') return {};
  const key = normalizeLabel(raw);
  if (key in map) return { value: map[key] };
  return { invalid: raw };
}

export function lookupGender(raw?: string) {
  return lookupLabel(raw, GENDER_LABELS);
}
export function lookupMaritalStatus(raw?: string) {
  return lookupLabel(raw, MARITAL_STATUS_LABELS);
}
export function lookupBloodType(raw?: string) {
  return lookupLabel(raw, BLOOD_TYPE_LABELS);
}
export function lookupRhesus(raw?: string) {
  return lookupLabel(raw, RHESUS_LABELS);
}
export function lookupBoolean(raw?: string) {
  return lookupLabel(raw, BOOLEAN_LABELS);
}
