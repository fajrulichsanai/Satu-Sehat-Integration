import type {
  PregnancyStatus,
  PsychologicalStatus,
} from '../../physical-examination/entities/physical-examination.entity';
import type { Prognosis } from '../../encounter-soap-notes/entities/encounter-soap-note.entity';
/**
 * Kode klinis untuk kasus gigi (Playbook RME Rawat Jalan / Postman
 * "24. Use Case - Gigi"). Setiap kode SNOMED CT di sini diverifikasi
 * terhadap data/terminology/snomed.tsv.gz (lihat tests/clinical-codes.spec.ts);
 * kode clinical-term (OC…/OV…) diambil dari contoh Postman resmi.
 */

export interface Coding {
  code: string;
  display: string;
}

/** Nomor gigi FDI → konsep SNOMED struktur gigi (bodySite odontogram). */
export const TOOTH_SNOMED: Record<number, Coding> = {
  11: {
    code: '422653006',
    display: 'Structure of permanent maxillary right central incisor tooth',
  },
  12: {
    code: '424877001',
    display: 'Structure of permanent maxillary right lateral incisor tooth',
  },
  13: {
    code: '860767006',
    display: 'Structure of permanent maxillary right canine tooth',
  },
  14: { code: '57826002', display: 'Maxillary right first premolar tooth' },
  15: { code: '36492000', display: 'Maxillary right second premolar tooth' },
  16: {
    code: '865995000',
    display: 'Structure of permanent maxillary right first molar tooth',
  },
  17: {
    code: '863902006',
    display: 'Structure of permanent maxillary right second molar tooth',
  },
  18: {
    code: '245566003',
    display: 'Entire maxillary right third molar tooth',
  },
  21: {
    code: '424399000',
    display: 'Structure of permanent maxillary left central incisor tooth',
  },
  22: {
    code: '423185002',
    display: 'Structure of permanent maxillary left lateral incisor tooth',
  },
  23: {
    code: '860780009',
    display: 'Structure of permanent maxillary left canine tooth',
  },
  24: { code: '61897005', display: 'Maxillary left first premolar tooth' },
  25: { code: '23226009', display: 'Maxillary left second premolar tooth' },
  26: {
    code: '865988009',
    display: 'Structure of permanent maxillary left first molar tooth',
  },
  27: {
    code: '863901004',
    display: 'Structure of permanent maxillary left second molar tooth',
  },
  28: { code: '87704003', display: 'Maxillary left third molar tooth' },
  31: {
    code: '425106001',
    display: 'Structure of permanent mandibular left central incisor tooth',
  },
  32: {
    code: '423331005',
    display: 'Structure of permanent mandibular left lateral incisor tooth',
  },
  33: {
    code: '860782001',
    display: 'Structure of permanent mandibular left canine tooth',
  },
  34: { code: '2400006', display: 'Mandibular left first premolar tooth' },
  35: { code: '24573005', display: 'Mandibular left second premolar tooth' },
  36: {
    code: '866006002',
    display: 'Structure of permanent mandibular left first molar tooth',
  },
  37: {
    code: '863898000',
    display: 'Structure of permanent mandibular left second molar tooth',
  },
  38: { code: '74344005', display: 'Mandibular left third molar tooth' },
  41: {
    code: '424575004',
    display: 'Structure of permanent mandibular right central incisor tooth',
  },
  42: {
    code: '423937004',
    display: 'Structure of permanent mandibular right lateral incisor tooth',
  },
  43: { code: '47055002', display: 'Mandibular right canine tooth' },
  44: { code: '80140008', display: 'Mandibular right first premolar tooth' },
  45: { code: '8873007', display: 'Mandibular right second premolar tooth' },
  46: {
    code: '866005003',
    display: 'Structure of permanent mandibular right first molar tooth',
  },
  47: { code: '863899008', display: 'Permanent lower right 7 tooth' },
  48: { code: '38994002', display: 'Mandibular right third molar tooth' },
  51: {
    code: '88824007',
    display: 'Deciduous maxillary right central incisor tooth',
  },
  52: {
    code: '65624003',
    display: 'Deciduous maxillary right lateral incisor tooth',
  },
  53: { code: '30618001', display: 'Deciduous maxillary right canine tooth' },
  54: {
    code: '17505006',
    display: 'Deciduous maxillary right first molar tooth',
  },
  55: {
    code: '27855007',
    display: 'Deciduous maxillary right second molar tooth',
  },
  61: {
    code: '51678005',
    display: 'Deciduous maxillary left central incisor tooth',
  },
  62: {
    code: '43622005',
    display: 'Deciduous maxillary left lateral incisor tooth',
  },
  63: { code: '73937000', display: 'Deciduous maxillary left canine tooth' },
  64: {
    code: '45234009',
    display: 'Deciduous maxillary left first molar tooth',
  },
  65: {
    code: '51943008',
    display: 'Deciduous maxillary left second molar tooth',
  },
  71: {
    code: '89552004',
    display: 'Deciduous mandibular left central incisor tooth',
  },
  72: {
    code: '14770005',
    display: 'Deciduous mandibular left lateral incisor tooth',
  },
  73: { code: '43281008', display: 'Deciduous mandibular left canine tooth' },
  74: {
    code: '38896004',
    display: 'Deciduous mandibular left first molar tooth',
  },
  75: {
    code: '49330006',
    display: 'Deciduous mandibular left second molar tooth',
  },
  81: {
    code: '67834006',
    display: 'Deciduous mandibular right central incisor tooth',
  },
  82: {
    code: '22445006',
    display: 'Deciduous mandibular right lateral incisor tooth',
  },
  83: { code: '6062009', display: 'Deciduous mandibular right canine tooth' },
  84: {
    code: '58646007',
    display: 'Deciduous mandibular right first molar tooth',
  },
  85: {
    code: '61868007',
    display: 'Deciduous mandibular right second molar tooth',
  },
};

/** Gigi anterior (insisivus & kaninus) memakai permukaan labial, sisanya bukal. */
export const isAnteriorTooth = (fdi: number) => [1, 2, 3].includes(fdi % 10);

/** Permukaan gigi (komponen 32889-8 "Surface [Identifier] Tooth"). */
export const SURFACE_SNOMED = {
  mesial: { code: '710099007', display: 'Mesial' },
  distal: { code: '46053002', display: 'Distal' },
  labial: { code: '261114002', display: 'Labial' },
  buccal: { code: '261062005', display: 'Buccal' },
  lingual: { code: '255579002', display: 'Palatal-lingual' },
  occlusal: { code: '257885003', display: 'Occlusion' },
} satisfies Record<string, Coding>;

export const DENTAL_CARIES: Coding = {
  code: '80967001',
  display: 'Dental caries',
};
export const TOOTH_FINDING: Coding = {
  code: '278544002',
  display: 'Tooth finding',
};
export const DENTAL_FILLING_MATERIAL: Coding = {
  code: '432680005',
  display: 'Dental filling material',
};
export const COMPOSITE_FILLING: Coding = {
  code: '256452006',
  display: 'Composite dental filling material',
};

/**
 * Anotasi odontogram ApexRecord → temuan gigi. `null` = tidak ada kode yang
 * pasti; dikirim sebagai teks saja.
 */
export const TOOTH_ANNOTATION: Record<
  string,
  { system: 'snomed' | 'clinical-term'; coding: Coding | null; text: string }
> = {
  MISSING: {
    system: 'snomed',
    coding: { code: '234948008', display: 'Tooth absent' },
    text: 'Gigi hilang',
  },
  CFR: {
    system: 'snomed',
    coding: { code: '278933001', display: 'Tooth crown fracture' },
    text: 'Fraktur mahkota',
  },
  RRX: {
    system: 'clinical-term',
    coding: { code: 'OV000093', display: 'Sisa Akar' },
    text: 'Sisa akar',
  },
  NON: {
    system: 'clinical-term',
    coding: { code: 'OV000092', display: 'Gigi Non-Vital' },
    text: 'Gigi non-vital',
  },
  ANO: {
    system: 'clinical-term',
    coding: { code: 'OV000091', display: 'Anomali' },
    text: 'Anomali',
  },
  UNE: {
    system: 'snomed',
    coding: { code: '278658009', display: 'Tooth unerupted' },
    text: 'Gigi belum erupsi',
  },
  PRE: {
    system: 'snomed',
    coding: { code: '278660006', display: 'Tooth partially erupted' },
    text: 'Gigi erupsi sebagian',
  },
  ATT: { system: 'snomed', coding: null, text: 'Atrisi' },
};

/** DMF-T (Postman "Jumlah Gigi Decayed/Missing/Filled") */
export const DMF_COUNT = {
  decayed: { code: '251319000', display: 'Decayed tooth count' },
  missing: { code: '251317003', display: 'Missing tooth count' },
  filled: { code: '251318008', display: 'Filled tooth count' },
} satisfies Record<string, Coding>;

/** Riwayat penyakit sistemik pasien → Condition problem-list-item */
export const HISTORY_CONDITION: Record<string, Coding> = {
  riwayatHipertensi: { code: '161501007', display: 'H/O: hypertension' },
  riwayatDiabetes: { code: '161445009', display: 'H/O: diabetes mellitus' },
  riwayatParuParu: { code: '161523006', display: 'H/O: respiratory disease' },
  riwayatSyaraf: { code: '118940003', display: 'Neurological disorder' },
};

/** Alergi pasien → AllergyIntolerance.code */
export const ALLERGY = {
  drug: { code: '416098002', display: 'Drug allergy' },
  food: { code: '414285001', display: 'Food allergy' },
  other: { code: '609328004', display: 'Allergy' },
} satisfies Record<string, Coding>;

/** Tingkat kesadaran (LOINC 67775-7) — pilihan di form pemeriksaan fisik */
export const CONSCIOUSNESS: Record<string, Coding> = {
  komposmentis: { code: '248234008', display: 'Mentally alert' },
  apatis: { code: '300202002', display: 'Responds to voice' },
  delirium: { code: '300202002', display: 'Responds to voice' },
  somnolen: { code: '300202002', display: 'Responds to voice' },
  sopor: { code: '450847001', display: 'Responds to pain' },
  soporokoma: { code: '450847001', display: 'Responds to pain' },
  koma: { code: '422768004', display: 'Unresponsive' },
};

/** Kondisi saat meninggalkan klinik (Postman "11. Kondisi saat Meninggalkan RS") */
export const DISCHARGE_CONDITION: Record<string, Coding> = {
  stable: { code: '359746009', display: 'Patient status stable' },
  improved: { code: '268910001', display: "Patient's condition improved" },
  worsened: { code: '271299001', display: "Patient's condition worsened" },
};

export const EDUCATION: Coding = { code: '409073007', display: 'Education' };
export const DISEASE_EDUCATION: Coding = {
  code: '84635008',
  display: 'Disease process or condition education',
};
export const FOLLOW_UP_VISIT: Coding = {
  code: '185389009',
  display: 'Follow-up visit',
};
export const SELF_REFERRAL: Coding = {
  code: '306098008',
  display: 'Referral by self',
};
export const CONSULTATION: Coding = {
  code: '11429006',
  display: 'Consultation',
};

// ── Dokter umum: Playbook RME Rawat Jalan bab 3–22 ──────────────────────

/**
 * Pemeriksaan fisik head-to-toe (bab 4) — kolom teks physical_examinations
 * → Observation kategori exam. Kolom yang tidak punya kode khusus di
 * playbook (kulit, KGB, ekstremitas, dst.) digabung ke "Physical findings".
 * `site` = kode SNOMED struktur tubuh bila playbook memakai kode LOINC umum.
 */
export interface ExamSite {
  loinc: Coding;
  site?: Coding;
  fields: { key: string; label?: string }[];
}

export const HEAD_TO_TOE: Record<string, ExamSite> = {
  head: {
    loinc: { code: '10199-8', display: 'Physical findings of Head Narrative' },
    fields: [{ key: 'head' }],
  },
  hair: {
    loinc: { code: '32436-8', display: 'Physical findings of Hair' },
    fields: [{ key: 'hair' }],
  },
  eyes: {
    loinc: { code: '10197-2', display: 'Physical findings of Eye Narrative' },
    fields: [{ key: 'eyes' }],
  },
  ears: {
    loinc: { code: '10195-6', display: 'Physical findings of Ear Narrative' },
    fields: [{ key: 'ears' }],
  },
  nose: {
    loinc: { code: '10203-8', display: 'Physical findings of Nose Narrative' },
    fields: [{ key: 'nose' }],
  },
  mouth: {
    loinc: {
      code: '10201-2',
      display: 'Physical findings of Mouth and Throat and Teeth Narrative',
    },
    fields: [{ key: 'mouth' }],
  },
  neck: {
    loinc: { code: '11411-6', display: 'Physical findings of Neck Narrative' },
    fields: [{ key: 'neck' }],
  },
  chest: {
    loinc: { code: '11391-0', display: 'Physical findings of Chest Narrative' },
    fields: [
      { key: 'lungInspection', label: 'Paru inspeksi' },
      { key: 'lungPalpation', label: 'Paru palpasi' },
      { key: 'lungPercussion', label: 'Paru perkusi' },
      { key: 'lungAuscultation', label: 'Paru auskultasi' },
      { key: 'heartInspection', label: 'Jantung inspeksi' },
      { key: 'heartPalpation', label: 'Jantung palpasi' },
      { key: 'heartPercussion', label: 'Jantung perkusi' },
      { key: 'heartAuscultation', label: 'Jantung auskultasi' },
    ],
  },
  abdomen: {
    loinc: {
      code: '10191-5',
      display: 'Physical findings of Abdomen Narrative',
    },
    fields: [
      { key: 'abdomenInspection', label: 'Inspeksi' },
      { key: 'abdomenPalpation', label: 'Palpasi' },
      { key: 'abdomenPercussion', label: 'Perkusi' },
      { key: 'abdomenAuscultation', label: 'Auskultasi' },
    ],
  },
  genitalia: {
    loinc: {
      code: '11400-9',
      display: 'Physical findings of Genitalia Narrative',
    },
    fields: [{ key: 'genitalia' }],
  },
  anus: {
    loinc: {
      code: '11388-6',
      display: 'Physical findings of Buttocks Narrative',
    },
    site: { code: '53505006', display: 'Anal structure' },
    fields: [{ key: 'rectal' }],
  },
  other: {
    loinc: { code: '29545-1', display: 'Physical findings Narrative' },
    fields: [
      { key: 'generalCondition', label: 'Keadaan umum' },
      { key: 'nutritionalStatus', label: 'Status gizi' },
      { key: 'skin', label: 'Kulit' },
      { key: 'lymphNodes', label: 'Kelenjar getah bening' },
      { key: 'extremities', label: 'Ekstremitas' },
      { key: 'cyanosis', label: 'Sianosis' },
      { key: 'edema', label: 'Edema' },
      { key: 'anemia', label: 'Anemia' },
      { key: 'jaundice', label: 'Ikterus' },
    ],
  },
};

/** Status psikologis (bab 5, LOINC 8693-4) */
export const PSYCHOLOGICAL_STATUS: Record<PsychologicalStatus, Coding> = {
  normal: { code: '17326005', display: 'Well in self' },
  anxious: { code: '48694002', display: 'Feeling anxious' },
  afraid: { code: '1402001', display: 'Afraid' },
  angry: { code: '75408008', display: 'Feeling angry' },
  sad: { code: '420038007', display: 'Feeling unhappy' },
  other: { code: '74964007', display: 'Other' },
};

/** Status kehamilan (Postman "Status Kehamilan Pasien", LOINC 82810-3) */
export const PREGNANCY_STATUS: Record<PregnancyStatus, Coding> = {
  pregnant: { code: '77386006', display: 'Pregnant' },
  not_pregnant: { code: '60001007', display: 'Not pregnant' },
  unknown: { code: '261665006', display: 'Unknown' },
};

/** Prognosis (bab 22) */
export const PROGNOSIS: Record<Prognosis, Coding> = {
  good: { code: '170968001', display: 'Prognosis good' },
  fair: { code: '65872000', display: 'Fair prognosis' },
  guarded: { code: '67334001', display: 'Guarded prognosis' },
  bad: { code: '170969009', display: 'Prognosis bad' },
};
export const DETERMINATION_OF_PROGNOSIS: Coding = {
  code: '20481000',
  display: 'Determination of prognosis',
};

/** Riwayat perjalanan penyakit (bab 6) */
export const HISTORY_OF_DISORDER: Coding = {
  code: '312850006',
  display: 'History of disorder',
};
/** Rasional klinis (bab 12) — CodeSystem terminology.kemkes.go.id */
export const CLINICAL_RATIONALE: Coding = {
  code: 'TK000056',
  display: 'Rasional Klinis',
};
/** Rencana rawat & instruksi medik (bab 8–9) */
export const OUTPATIENT_CARE_PLAN: Coding = {
  code: '736271009',
  display: 'Outpatient care plan',
};

// ── Pemeriksaan penunjang (Playbook bab 10–11) ──────────────────────────

export const LAB_PROCEDURE: Coding = { code: '108252007', display: 'Laboratory procedure' };
export const IMAGING: Coding = { code: '363679005', display: 'Imaging' };
export const DIAGNOSTIC_PROCEDURE: Coding = { code: '103693007', display: 'Diagnostic procedure' };
export const FASTING: Coding = { code: '792805006', display: 'Fasting' };
export const BLOOD_COLLECTION: Coding = { code: '82078001', display: 'Collection of blood specimen for laboratory' };

/**
 * Jenis spesimen di katalog lab (Bahasa Indonesia) → SNOMED CT specimen
 * (< 123038009). Daftar Rujukan Spesimen SATUSEHAT + padanan umum.
 */
export const SPECIMEN_SNOMED: Record<string, Coding> = {
  darah: { code: '119297000', display: 'Blood specimen' },
  'darah arteri': { code: '122552005', display: 'Arterial blood specimen' },
  serum: { code: '119364003', display: 'Serum specimen' },
  'serum/plasma': { code: '119364003', display: 'Serum specimen' },
  plasma: { code: '119361006', display: 'Plasma specimen' },
  urine: { code: '122575003', display: 'Urine specimen' },
  urin: { code: '122575003', display: 'Urine specimen' },
  'urine 24 jam': { code: '276833005', display: '24 hour urine sample' },
  feses: { code: '119339001', display: 'Stool specimen' },
  sputum: { code: '119334006', display: 'Sputum specimen' },
  sperma: { code: '119347001', display: 'Seminal fluid specimen' },
  semen: { code: '119347001', display: 'Seminal fluid specimen' },
  'sumsum tulang': { code: '119359002', display: 'Bone marrow specimen' },
  'cairan otak': { code: '258450006', display: 'Cerebrospinal fluid sample' },
  'cairan pleura': { code: '418564007', display: 'Pleural fluid specimen' },
  'cairan peritoneal': { code: '168139001', display: 'Peritoneal fluid sample' },
  'cairan asites': { code: '168139001', display: 'Peritoneal fluid sample' },
  'cairan sendi': { code: '119332005', display: 'Synovial fluid specimen' },
  'cairan tubuh': { code: '309051001', display: 'Body fluid sample' },
  swab: { code: '257261003', display: 'Swab' },
  'swab/ sekret': { code: '257261003', display: 'Swab' },
  'swab naso & orofaring': { code: '258500001', display: 'Nasopharyngeal swab' },
  'swab tenggorok': { code: '258529004', display: 'Throat swab' },
  vagina: { code: '258520000', display: 'Vaginal swab' },
  'cairan vagina': { code: '258520000', display: 'Vaginal swab' },
  uretra: { code: '258530009', display: 'Urethral swab' },
  pus: { code: '119323008', display: 'Pus specimen' },
  jaringan: { code: '119376003', display: 'Tissue specimen' },
  isolat: { code: '119303007', display: 'Microbial isolate specimen' },
  'batu ginjal': { code: '119350003', display: 'Calculus specimen' },
  'batu empedu': { code: '119350003', display: 'Calculus specimen' },
  rambut: { code: '119326000', display: 'Hair specimen' },
  saliva: { code: '119342007', display: 'Saliva specimen' },
};

/** Kategori katalog lab → DiagnosticReport.category (HL7 v2-0074) */
export const LAB_REPORT_CATEGORY: Record<string, Coding> = {
  hematologi: { code: 'HM', display: 'Hematology' },
  'kimia klinik': { code: 'CH', display: 'Chemistry' },
  mikrobiologi: { code: 'MB', display: 'Microbiology' },
  imunoserologi: { code: 'SR', display: 'Serology' },
  molekuler: { code: 'GE', display: 'Genetics' },
  sitologi: { code: 'CP', display: 'Cytopathology' },
  'bank darah': { code: 'BLB', display: 'Blood Bank' },
  patologi: { code: 'SP', display: 'Surgical Pathology' },
};

export const INTERPRETATION_DISPLAY: Record<string, string> = {
  N: 'Normal',
  L: 'Low',
  H: 'High',
  LL: 'Critical low',
  HH: 'Critical high',
  A: 'Abnormal',
  POS: 'Positive',
  NEG: 'Negative',
};

/** v2-0916 status puasa pada Specimen.collection */
export const FASTING_STATUS_V2: Record<string, Coding> = {
  fasting: { code: 'F', display: 'Patient was fasting prior to the procedure.' },
  not_fasting: { code: 'NF', display: 'The patient indicated they did not fast prior to the procedure.' },
  not_required: { code: 'NG', display: 'Not Given - Patient was not asked at the time of the procedure.' },
};
