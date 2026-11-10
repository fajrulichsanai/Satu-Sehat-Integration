/**
 * Terminologi Playbook "Rujukan Pasien" v6.1 (Lampiran 1–4) dan contoh
 * Postman "30. Use Case - Rujukan Pasien".
 */
export const KEMKES = 'http://terminology.kemkes.go.id';
export const SNOMED = 'http://snomed.info/sct';
export const ICD10 = 'http://hl7.org/fhir/sid/icd-10';
export const CLINICAL_SPECIALITY =
  'http://terminology.kemkes.go.id/CodeSystem/clinical-speciality';
export const ADMIN_AREA = 'http://sys-ids.kemkes.go.id/administrative-area';
export const REFERRAL_NUMBER_SYSTEMS = [
  'http://sys-ids.kemkes.go.id/referral-number-satusehat',
  'http://sys-ids.kemkes.go.id/referral-number',
];
export const PCARE_NUMBER_SYSTEM =
  'http://sys-ids.kemkes.go.id/referral-number-pcare';

/** Kuesioner yang dijawab Fasyankes Perujuk (contoh Postman) */
export const CRITERIA_QUESTIONNAIRE =
  'https://fhir.kemkes.go.id/Questionnaire/Q100';
export const AREA_QUESTIONNAIRE =
  'https://fhir.kemkes.go.id/Questionnaire/Q101';

/**
 * Jenis rujukan. Saat ini hanya Rawat Jalan: rawat inap & rawat darurat
 * butuh persetujuan RS tujuan (Task referral-approval) dan menyusul bersama
 * modul IGD/Rawat Inap.
 */
export const CARE_TYPES = {
  outpatient: {
    label: 'Rawat Jalan',
    /** Lampiran 1 — ServiceRequest.code & Task tipe perawatan */
    code: {
      system: SNOMED,
      code: '737492002',
      display: 'Outpatient care management',
    },
    /** Lampiran 3 — CarePlan.category[0] */
    planCategory: {
      system: SNOMED,
      code: '736271009',
      display: 'Outpatient care plan',
    },
  },
} as const;
export type CareType = keyof typeof CARE_TYPES;
export const CARE_TYPE_KEYS = Object.keys(CARE_TYPES) as CareType[];

/** Lampiran 4 — Kelompok Layanan (Task.input TK000562) */
export const SERVICE_GROUPS: ReadonlyArray<readonly [string, string]> = [
  ['TK000563', 'Kelompok Layanan Jantung dan Pembuluh Darah'],
  ['TK000564', 'Kelompok Layanan Paru-Pernapasan'],
  ['TK000565', 'Kelompok Layanan Uronefro-Ginjal'],
  ['TK000566', 'Kelompok Layanan Neonatus'],
  ['TK000567', 'Kelompok Layanan Neoplasma'],
  ['TK000568', 'Kelompok Layanan Ibu dan Ginekologi'],
  ['TK000569', 'Kelompok Layanan Muskuloskeletal dan Jaringan Lunak'],
  ['TK000570', 'Kelompok Layanan THT'],
  ['TK000571', 'Kelompok Layanan Mata'],
  ['TK000572', 'Kelompok Layanan Kulit dan Kelamin'],
  ['TK000573', 'Kelompok Layanan Saraf Neurosain'],
  ['TK000574', 'Kelompok Layanan Infeksi dan Parasit'],
  ['TK000575', 'Kelompok Layanan Pencernaan dan Hepatobiliar'],
  ['TK000576', 'Kelompok Layanan Hematologi'],
  ['TK000577', 'Kelompok Layanan Alergi dan Rhematologi'],
  ['TK000578', 'Kelompok Layanan Rekonstruksi dan Estetika'],
  ['TK000579', 'Kelompok Layanan Keracunan'],
  ['TK000580', 'Kelompok Layanan Endocrine, Nutrition, dan Metabolik'],
  ['TK000581', 'Kelompok Layanan Luka Bakar - Burn'],
  ['TK000582', 'Kelompok Layanan Trauma'],
  ['TK000583', 'Kelompok Layanan Jiwa'],
  ['TK000584', 'Kelompok Layanan Gigi dan Mulut'],
  ['TK000585', 'Kelompok Layanan Forensik'],
  ['TK000586', 'Kelompok Layanan Rehabilitasi'],
];

/** ServiceRequest.locationCode — jenis fasyankes rujukan (v3-RoleCode, contoh Postman) */
export const FACILITY_TYPE = {
  system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
  code: 'HOSP',
  display: 'Hospital',
} as const;

/** Lampiran 2 — Jenis transportasi rujukan (ServiceRequest.locationCode) */
export const TRANSPORTS: ReadonlyArray<readonly [string, string, string]> = [
  ['49122002', 'Ambulance', 'Ambulans'],
  [
    '1285128001',
    'Emergency and resuscitation ambulance',
    'Ambulans Gawat Darurat',
  ],
  ['465341007', 'Automobile ambulance', 'Ambulance Transport (PSC)'],
  ['71783008', 'Car', 'Mobil'],
  ['90748009', 'Motorcycle', 'Motor'],
  ['74964007', 'Other', 'Lain-lain'],
];
