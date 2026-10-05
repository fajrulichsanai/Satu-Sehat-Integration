/**
 * Pemetaan data ApexRecord → resource FHIR SATUSEHAT.
 *
 * Mengikuti Playbook Interoperabilitas "RME Rawat Jalan" dan koleksi Postman
 * resmi "24. Use Case - Gigi" (file *.postman_collection.json di root repo).
 * Semua referensi Patient/Practitioner/Location/Encounter memakai ID
 * SATUSEHAT (IHS), bukan ID lokal.
 *
 * Sumber data:
 *   Encounter            ← encounters
 *   Observation (vital)  ← physical_examinations
 *   Observation (OHIS)   ← dental_examinations
 *   Condition            ← encounter_soap_notes.diagnoses (ICD-10 / SNOMED CT)
 *   Procedure            ← billing_items → tarifs.kode_icd9
 *   Medication + Request ← prescription_items.kfa_code (+ detail KFA)
 */
import { Encounter } from '../../encounters/entities/encounter.entity';
import { Location } from '../../location/entities/location.entity';
import { PhysicalExamination } from '../../physical-examination/entities/physical-examination.entity';
import { DentalExamination } from '../../dental-examination/entities/dental-examination.entity';
import {
  SoapDiagnosis,
  SoapDiet,
  SoapGoal,
  SoapRisk,
} from '../../encounter-soap-notes/entities/encounter-soap-note.entity';
import { PrescriptionItem } from '../../prescriptions/entities/prescription-item.entity';
import { PrescriptionReview } from '../../prescriptions/entities/prescription-review.entity';
import {
  PRESCRIPTION_REVIEW_GROUPS,
  PRESCRIPTION_REVIEW_QUESTIONNAIRE,
} from '../../prescriptions/prescription-review.questions';
import { KfaProduct } from '../kfa/kfa.service';
import { Patient } from '../../patients/entities/patient.entity';
import { ToothCondition } from '../../odontogram/entities/tooth-condition.entity';
import { DentalBridge } from '../../odontogram/entities/dental-bridge.entity';
import {
  ALLERGY,
  COMPOSITE_FILLING,
  CONSCIOUSNESS,
  CLINICAL_RATIONALE,
  CONSULTATION,
  Coding,
  DETERMINATION_OF_PROGNOSIS,
  HEAD_TO_TOE,
  HISTORY_OF_DISORDER,
  OUTPATIENT_CARE_PLAN,
  PREGNANCY_STATUS,
  PROGNOSIS,
  PSYCHOLOGICAL_STATUS,
  DENTAL_CARIES,
  DENTAL_FILLING_MATERIAL,
  DISCHARGE_CONDITION,
  DISEASE_EDUCATION,
  DMF_COUNT,
  EDUCATION,
  FOLLOW_UP_VISIT,
  HISTORY_CONDITION,
  SELF_REFERRAL,
  SURFACE_SNOMED,
  TOOTH_ANNOTATION,
  TOOTH_FINDING,
  TOOTH_SNOMED,
  isAnteriorTooth,
} from './clinical-codes';

export const SYS = {
  ACT_CODE: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
  PARTICIPATION: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
  OBS_CATEGORY: 'http://terminology.hl7.org/CodeSystem/observation-category',
  COND_CATEGORY: 'http://terminology.hl7.org/CodeSystem/condition-category',
  COND_CLINICAL: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
  DIAGNOSIS_ROLE: 'http://terminology.hl7.org/CodeSystem/diagnosis-role',
  DISCHARGE: 'http://terminology.hl7.org/CodeSystem/discharge-disposition',
  LOCATION_TYPE: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
  MEDREQ_CATEGORY:
    'http://terminology.hl7.org/CodeSystem/medicationrequest-category',
  LOINC: 'http://loinc.org',
  SNOMED: 'http://snomed.info/sct',
  UCUM: 'http://unitsofmeasure.org',
  ICD10: 'http://hl7.org/fhir/sid/icd-10',
  ICD9CM: 'http://hl7.org/fhir/sid/icd-9-cm',
  KFA: 'http://sys-ids.kemkes.go.id/kfa',
  ATC_ROUTE: 'http://www.whocc.no/atc',
  ALLERGY_CLINICAL:
    'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
  ALLERGY_VERIFICATION:
    'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
  ROLE_CODE: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
  CLINICAL_TERM: 'http://terminology.kemkes.go.id/CodeSystem/clinical-term',
  KEMKES_TERM: 'http://terminology.kemkes.go.id',
  MEDICATION_FORM: 'http://terminology.kemkes.go.id/CodeSystem/medication-form',
  MEDICATION_TYPE: 'http://terminology.kemkes.go.id/CodeSystem/medication-type',
  SERVICE_CLASS_OUTPATIENT:
    'http://terminology.kemkes.go.id/CodeSystem/locationServiceClass-Outpatient',
  UPGRADE_CLASS:
    'http://terminology.kemkes.go.id/CodeSystem/locationUpgradeClass',
} as const;

export const ids = (kind: string, orgId: string) =>
  `http://sys-ids.kemkes.go.id/${kind}/${orgId}`;

/** Referensi SATUSEHAT yang sudah di-resolve untuk satu kunjungan. */
export interface FhirContext {
  orgId: string;
  patient: { id: string; name: string };
  practitioner: { id: string; name: string };
  location: { id: string; name: string };
  /** Tidak ada saat membuat Encounter pertama kali */
  encounterId?: string;
}

/** Hasil mapping yang ID-nya disimpan di satusehat_resource_links */
export interface LinkedResource {
  localType: string;
  localId: number;
  resource: Record<string, any>;
}

/**
 * Waktu wajib UTC+00 dengan format `2023-09-09T18:00:00+00:00`
 * dan tidak boleh sebelum 3 Juni 2014.
 */
export function fhirDateTime(value?: Date | string | null): string | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().replace(/\.\d{3}Z$/, '+00:00');
}

/** Angka pertama dalam teks bebas, mis. "15 tablet" → 15 */
export function leadingNumber(text?: string | null): number | undefined {
  const m = text?.replace(',', '.').match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

/** Durasi teks bebas → hari, mis. "5 hari" → 5, "2 minggu" → 14 */
export function durationDays(text?: string | null): number | undefined {
  const n = leadingNumber(text);
  if (!n || !text) return undefined;
  const t = text.toLowerCase();
  if (/minggu|week/.test(t)) return n * 7;
  if (/bulan|month/.test(t)) return n * 30;
  if (/hari|day|^\s*\d+\s*$/.test(t)) return n;
  return undefined;
}

export const patientRef = (ctx: FhirContext) => ({
  reference: `Patient/${ctx.patient.id}`,
  display: ctx.patient.name,
});
export const practitionerRef = (ctx: FhirContext) => ({
  reference: `Practitioner/${ctx.practitioner.id}`,
  display: ctx.practitioner.name,
});
export const encounterRef = (ctx: FhirContext) => ({
  reference: `Encounter/${ctx.encounterId}`,
});

/** Tanda vital pemeriksaan fisik → LOINC + satuan UCUM */
const VITAL_SIGNS: {
  field: keyof PhysicalExamination;
  loinc: string;
  display: string;
  unit: string;
  code: string;
}[] = [
  {
    field: 'bloodPressureSystolic',
    loinc: '8480-6',
    display: 'Systolic blood pressure',
    unit: 'mm[Hg]',
    code: 'mm[Hg]',
  },
  {
    field: 'bloodPressureDiastolic',
    loinc: '8462-4',
    display: 'Diastolic blood pressure',
    unit: 'mm[Hg]',
    code: 'mm[Hg]',
  },
  {
    field: 'pulseRate',
    loinc: '8867-4',
    display: 'Heart rate',
    unit: 'beats/minute',
    code: '/min',
  },
  {
    field: 'respiratoryRate',
    loinc: '9279-1',
    display: 'Respiratory rate',
    unit: 'breaths/minute',
    code: '/min',
  },
  {
    field: 'temperature',
    loinc: '8310-5',
    display: 'Body temperature',
    unit: 'C',
    code: 'Cel',
  },
  {
    field: 'oxygenSaturation',
    loinc: '59408-5',
    display: 'Oxygen saturation in Arterial blood by Pulse oximetry',
    unit: '%',
    code: '%',
  },
  {
    field: 'height',
    loinc: '8302-2',
    display: 'Body height',
    unit: 'cm',
    code: 'cm',
  },
  {
    field: 'weight',
    loinc: '29463-7',
    display: 'Body weight',
    unit: 'kg',
    code: 'kg',
  },
];

const ENCOUNTER_STATUS: Record<string, string> = {
  arrived: 'arrived',
  in_progress: 'in-progress',
  finished: 'finished',
  cancelled: 'cancelled',
};

const isFilled = (v: unknown) => v !== null && v !== undefined && v !== '';

const ROUTE_DISPLAY: Record<string, string> = {
  O: 'Oral',
  P: 'Parenteral',
  R: 'Rectal',
  V: 'Vaginal',
  N: 'Nasal',
  SL: 'Sublingual',
  TD: 'Transdermal',
};

const ORDERABLE_DRUG_FORM = 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm';
const UCUM_UNITS: Record<string, string> = { mg: 'mg', g: 'g', mcg: 'ug', mL: 'mL', IU: '[IU]' };

/** Kekuatan bahan racikan: satuan UCUM atau bentuk sediaan (TAB, CAP, …) */
export function strengthQuantity(value: number, unit: string) {
  return UCUM_UNITS[unit]
    ? { value, system: SYS.UCUM, code: UCUM_UNITS[unit] }
    : { value, system: ORDERABLE_DRUG_FORM, code: unit };
}

function medicationTypeExtension(code: 'NC' | 'SD' | 'EP') {
  const display = { NC: 'Non-compound', SD: 'Gives of such doses', EP: 'Divide into equal parts' }[code];
  return {
    url: 'https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType',
    valueCodeableConcept: { coding: [{ system: SYS.MEDICATION_TYPE, code, display }] },
  };
}

function medicationBatch(batch?: { lotNumber?: string | null; expirationDate?: string | null } | null) {
  if (!batch?.lotNumber && !batch?.expirationDate) return {};
  return {
    batch: {
      ...(batch.lotNumber ? { lotNumber: batch.lotNumber } : {}),
      ...(batch.expirationDate ? { expirationDate: fhirDateTime(`${batch.expirationDate}T00:00:00+07:00`) } : {}),
    },
  };
}

/** Rute: pilihan di resep, atau rute produk KFA */
function routeOf(item: PrescriptionItem, kfa: KfaProduct | null) {
  const code = item.routeCode ?? kfa?.route?.code;
  if (!code) return {};
  const display = item.routeCode ? ROUTE_DISPLAY[item.routeCode] : kfa?.route?.name;
  return { route: { coding: [{ system: SYS.ATC_ROUTE, code, ...(display ? { display } : {}) }] } };
}

/** Jumlah obat: satuan racikan (CAP/POWD…) atau satuan produk KFA */
function dispenseQuantity(item: PrescriptionItem, kfa: KfaProduct | null, value: number) {
  if (item.compoundType && item.compoundUnit) return strengthQuantity(value, item.compoundUnit);
  return { value, ...(kfa?.uom ? { unit: kfa.uom } : {}) };
}

export const RESUME_GROUPS = [
  'chiefComplaint',
  'allergy',
  'history',
  'vitals',
  'exam',
  'functional',
  'carePlan',
  'lab',
  'radiology',
  'diagnosis',
  'procedure',
  'medication',
  'diet',
  'education',
  'discharge',
  'followUp',
] as const;
export type ResumeGroup = (typeof RESUME_GROUPS)[number];

/** localType link → section resume medis */
export function resumeGroupOf(localType: string): ResumeGroup | null {
  if (localType === 'soap_chief_complaint') return 'chiefComplaint';
  if (localType.startsWith('pt_allergy')) return 'allergy';
  if (localType.startsWith('pt_hist') || localType === 'soap_history') return 'history';
  if (/^pe_\d/.test(localType) || localType === 'pe_consciousness' || localType === 'pe_pain') return 'vitals';
  if (localType.startsWith('pe_exam') || localType.startsWith('de_') || localType.startsWith('odo_') || localType.startsWith('dmf_') || localType.startsWith('ohis') || localType === 'dental_notes') return 'exam';
  if (localType === 'pe_psychological' || localType === 'pe_pregnancy') return 'functional';
  if (['soap_care_plan', 'soap_instruction', 'soap_goal'].includes(localType)) return 'carePlan';
  if (localType.startsWith('lab_')) return 'lab';
  if (localType.startsWith('rad_')) return 'radiology';
  if (localType.startsWith('soap_dx') || localType === 'soap_rationale' || localType === 'soap_risk') return 'diagnosis';
  if (localType === 'billing_item') return 'procedure';
  if (['rx_item', 'rx_dispense', 'rx_administration'].includes(localType)) return 'medication';
  if (localType === 'soap_diet') return 'diet';
  if (localType === 'soap_education') return 'education';
  if (localType === 'soap_discharge' || localType === 'soap_prognosis') return 'discharge';
  if (localType === 'soap_follow_up') return 'followUp';
  return null;
}

function escapeXml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class FhirMapper {
  // ── Prasyarat ──────────────────────────────────────────────────────────

  /** Location ruang/poli — Postman "00. Location - Create Poli Gigi dan Mulut" */
  static toLocation(location: Location, orgId: string) {
    return {
      resourceType: 'Location',
      identifier: [
        { system: ids('location', orgId), value: `LOC-${location.id}` },
      ],
      status: location.isActive === false ? 'inactive' : 'active',
      name: location.name,
      description: location.name,
      mode: 'instance',
      physicalType: {
        coding: [{ system: SYS.LOCATION_TYPE, code: 'ro', display: 'Room' }],
      },
      managingOrganization: { reference: `Organization/${orgId}` },
      extension: [
        {
          url: 'https://fhir.kemkes.go.id/r4/StructureDefinition/LocationServiceClass',
          valueCodeableConcept: {
            coding: [
              {
                system: SYS.SERVICE_CLASS_OUTPATIENT,
                code: 'reguler',
                display: 'Kelas Reguler',
              },
            ],
          },
        },
      ],
    };
  }

  // ── 02. Pendaftaran Kunjungan & 12. Cara Keluar ───────────────────────

  /**
   * Encounter rawat jalan. statusHistory mengikuti waktu lokal
   * arrived → in-progress → finished. Saat finished, `diagnosis` (rank 1 =
   * diagnosis utama) dan `hospitalization.dischargeDisposition` diisi.
   */
  static toEncounter(
    encounter: Encounter,
    ctx: FhirContext,
    diagnoses: { conditionId: string; display: string }[] = [],
  ) {
    const status = ENCOUNTER_STATUS[encounter.status] ?? 'arrived';
    const arrived = fhirDateTime(encounter.arrivedTime ?? encounter.createdAt);
    const inProgress = fhirDateTime(encounter.inProgressTime);
    const finished = fhirDateTime(encounter.finishedTime);
    const isFinished = status === 'finished';

    const statusHistory: {
      status: string;
      period: { start?: string; end?: string };
    }[] = [
      {
        status: 'arrived',
        period: {
          start: arrived,
          end: inProgress ?? (isFinished ? finished : undefined),
        },
      },
    ];
    if (inProgress && (status === 'in-progress' || isFinished)) {
      statusHistory.push({
        status: 'in-progress',
        period: { start: inProgress, end: isFinished ? finished : undefined },
      });
    }
    if (isFinished) {
      statusHistory.push({
        status: 'finished',
        period: { start: finished, end: finished },
      });
    }
    if (status === 'cancelled') {
      statusHistory.push({
        status: 'cancelled',
        period: { start: fhirDateTime(encounter.updatedAt) },
      });
    }

    const period = { start: arrived, end: isFinished ? finished : undefined };

    return {
      resourceType: 'Encounter',
      ...(ctx.encounterId ? { id: ctx.encounterId } : {}),
      identifier: [
        { system: ids('encounter', ctx.orgId), value: String(encounter.id) },
      ],
      status,
      class: { system: SYS.ACT_CODE, code: 'AMB', display: 'ambulatory' },
      subject: patientRef(ctx),
      participant: [
        {
          type: [
            {
              coding: [
                {
                  system: SYS.PARTICIPATION,
                  code: 'ATND',
                  display: 'attender',
                },
              ],
            },
          ],
          individual: practitionerRef(ctx),
        },
      ],
      period,
      location: [
        {
          location: {
            reference: `Location/${ctx.location.id}`,
            display: ctx.location.name,
          },
          ...(isFinished ? { period } : {}),
          extension: [
            {
              url: 'https://fhir.kemkes.go.id/r4/StructureDefinition/ServiceClass',
              extension: [
                {
                  url: 'value',
                  valueCodeableConcept: {
                    coding: [
                      {
                        system: SYS.SERVICE_CLASS_OUTPATIENT,
                        code: 'reguler',
                        display: 'Kelas Reguler',
                      },
                    ],
                  },
                },
                {
                  url: 'upgradeClassIndicator',
                  valueCodeableConcept: {
                    coding: [
                      {
                        system: SYS.UPGRADE_CLASS,
                        code: 'kelas-tetap',
                        display: 'Kelas Tetap Perawatan',
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
      ...(isFinished && diagnoses.length
        ? {
            diagnosis: diagnoses.map((d, i) => ({
              condition: {
                reference: `Condition/${d.conditionId}`,
                display: d.display,
              },
              use: {
                coding: [
                  {
                    system: SYS.DIAGNOSIS_ROLE,
                    code: 'DD',
                    display: 'Discharge diagnosis',
                  },
                ],
              },
              rank: i + 1,
            })),
          }
        : {}),
      statusHistory,
      ...(isFinished
        ? {
            hospitalization: {
              dischargeDisposition: {
                coding: [
                  { system: SYS.DISCHARGE, code: 'home', display: 'Home' },
                ],
                text: 'Pasien pulang',
              },
            },
          }
        : {}),
      serviceProvider: { reference: `Organization/${ctx.orgId}` },
    };
  }

  // ── 04. Pemeriksaan Fisik ─────────────────────────────────────────────

  /** Satu Observation per tanda vital yang terisi. */
  static toVitalSignObservations(
    pe: PhysicalExamination,
    ctx: FhirContext,
  ): LinkedResource[] {
    const when = fhirDateTime(pe.updatedAt ?? pe.createdAt);
    return VITAL_SIGNS.filter((v) => isFilled(pe[v.field])).map((v) => ({
      localType: `pe_${v.loinc}`,
      localId: pe.id,
      resource: {
        resourceType: 'Observation',
        status: 'final',
        category: [
          {
            coding: [
              {
                system: SYS.OBS_CATEGORY,
                code: 'vital-signs',
                display: 'Vital Signs',
              },
            ],
          },
        ],
        code: {
          coding: [{ system: SYS.LOINC, code: v.loinc, display: v.display }],
        },
        subject: patientRef(ctx),
        performer: [practitionerRef(ctx)],
        encounter: encounterRef(ctx),
        effectiveDateTime: when,
        issued: when,
        valueQuantity: {
          value: Number(pe[v.field]),
          unit: v.unit,
          system: SYS.UCUM,
          code: v.code,
        },
      },
    }));
  }

  /** OHIS — skor total DI-S, CI-S, OHI-S (Postman "04. OHIS") */
  static toOhisObservations(
    de: DentalExamination,
    ctx: FhirContext,
  ): LinkedResource[] {
    const when = fhirDateTime(de.updatedAt ?? de.createdAt);
    const make = (
      localType: string,
      code: string,
      display: string,
      value: number,
    ): LinkedResource => ({
      localType,
      localId: de.id,
      resource: {
        resourceType: 'Observation',
        status: 'final',
        category: [
          {
            coding: [
              { system: SYS.OBS_CATEGORY, code: 'exam', display: 'Exam' },
            ],
          },
        ],
        code: { coding: [{ system: SYS.CLINICAL_TERM, code, display }] },
        subject: patientRef(ctx),
        performer: [practitionerRef(ctx)],
        encounter: encounterRef(ctx),
        effectiveDateTime: when,
        issued: when,
        valueQuantity: {
          value: Math.round(value * 10) / 10,
          unit: '{score}',
          system: SYS.UCUM,
          code: '{score}',
        },
      },
    });
    const di = isFilled(de.ohisDebris) ? Number(de.ohisDebris) : null;
    const ci = isFilled(de.ohisCalculus) ? Number(de.ohisCalculus) : null;
    const out: LinkedResource[] = [];
    if (di !== null)
      out.push(make('ohis_di', 'OC000056', 'Skor Total Debris Indeks', di));
    if (ci !== null)
      out.push(make('ohis_ci', 'OC000057', 'Skor Total Kalkulus Indeks', ci));
    if (di !== null && ci !== null) {
      out.push(
        make(
          'ohis_total',
          'OC000058',
          'Skor Total Oral Hygiene Index Simplified (OHIS)',
          di + ci,
        ),
      );
    }
    return out;
  }

  // ── 07. Diagnosis ─────────────────────────────────────────────────────

  /** Diagnosis terkode dari SOAP (ICD-10 atau SNOMED CT). */
  static toCondition(dx: SoapDiagnosis, recordedAt: Date, ctx: FhirContext) {
    const recorded = fhirDateTime(recordedAt);
    return {
      resourceType: 'Condition',
      clinicalStatus: {
        coding: [
          { system: SYS.COND_CLINICAL, code: 'active', display: 'Active' },
        ],
      },
      category: [
        {
          coding: [
            {
              system: SYS.COND_CATEGORY,
              code: 'encounter-diagnosis',
              display: 'Encounter Diagnosis',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: dx.system === 'snomed' ? SYS.SNOMED : SYS.ICD10,
            code: dx.code,
            display: dx.display,
          },
        ],
        ...(dx.nameId ? { text: dx.nameId } : {}),
      },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      onsetDateTime: recorded,
      recordedDate: recorded,
      ...(dx.note ? { note: [{ text: dx.note }] } : {}),
    };
  }

  // ── 08. Tindakan ──────────────────────────────────────────────────────

  /** Tindakan dari item tagihan yang tarifnya punya kode ICD-9-CM. */
  static toProcedure(
    item: { name: string; tarif: { kodeIcd9: string; name: string } },
    encounter: Encounter,
    ctx: FhirContext,
    reason?: SoapDiagnosis | null,
  ) {
    const start = fhirDateTime(
      encounter.inProgressTime ?? encounter.arrivedTime,
    );
    const end = fhirDateTime(encounter.finishedTime) ?? start;
    return {
      resourceType: 'Procedure',
      status: 'completed',
      category: {
        coding: [
          {
            system: SYS.SNOMED,
            code: '277132007',
            display: 'Therapeutic procedure',
          },
        ],
        text: 'Therapeutic procedure',
      },
      code: {
        coding: [
          {
            system: SYS.ICD9CM,
            code: item.tarif.kodeIcd9,
            display: item.tarif.name,
          },
        ],
        ...(item.name && item.name !== item.tarif.name
          ? { text: item.name }
          : {}),
      },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      performedPeriod: { start, end },
      performer: [{ actor: practitionerRef(ctx) }],
      ...(reason
        ? {
            reasonCode: [
              {
                coding: [
                  {
                    system: reason.system === 'snomed' ? SYS.SNOMED : SYS.ICD10,
                    code: reason.code,
                    display: reason.display,
                  },
                ],
              },
            ],
          }
        : {}),
    };
  }

  // ── 09. Tatalaksana: Peresepan Obat ───────────────────────────────────

  /** Medication "for Request" — kode KFA + bentuk sediaan & zat aktif dari KFA. */
  static toMedication(
    kfa: KfaProduct,
    ctx: FhirContext,
    identifierValue: string,
    batch?: { lotNumber?: string | null; expirationDate?: string | null } | null,
  ) {
    return {
      resourceType: 'Medication',
      meta: {
        profile: [
          'https://fhir.kemkes.go.id/r4/StructureDefinition/Medication',
        ],
      },
      identifier: [
        {
          system: ids('medication', ctx.orgId),
          use: 'official',
          value: identifierValue,
        },
      ],
      code: {
        coding: [{ system: SYS.KFA, code: kfa.kfaCode, display: kfa.name }],
      },
      status: 'active',
      manufacturer: { reference: `Organization/${ctx.orgId}` },
      ...(kfa.dosageForm
        ? {
            form: {
              coding: [
                {
                  system: SYS.MEDICATION_FORM,
                  code: kfa.dosageForm.code,
                  display: kfa.dosageForm.name,
                },
              ],
            },
          }
        : {}),
      ...(kfa.activeIngredients.length
        ? {
            ingredient: kfa.activeIngredients.map((i) => ({
              itemCodeableConcept: {
                coding: [{ system: SYS.KFA, code: i.kfaCode, display: i.name }],
              },
              isActive: true,
            })),
          }
        : {}),
      ...medicationBatch(batch),
      extension: [medicationTypeExtension('NC')],
    };
  }

  /**
   * Obat racikan (Postman "Variasi Peresepan": salep/puyer/kapsul racikan):
   * tanpa Medication.code; tiap bahan berkode KFA beserta kekuatannya,
   * MedicationType SD (d.t.d) atau EP (dibagi rata).
   */
  static toCompoundMedication(
    item: PrescriptionItem,
    ctx: FhirContext,
    identifierValue: string,
    batch?: { lotNumber?: string | null; expirationDate?: string | null } | null,
  ) {
    return {
      resourceType: 'Medication',
      meta: { profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/Medication'] },
      identifier: [{ system: ids('medication', ctx.orgId), use: 'official', value: identifierValue }],
      status: 'active',
      ...(item.compoundFormCode
        ? {
            form: {
              coding: [
                {
                  system: SYS.MEDICATION_FORM,
                  code: item.compoundFormCode,
                  ...(item.compoundFormName ? { display: item.compoundFormName } : {}),
                },
              ],
            },
          }
        : {}),
      ingredient: (item.ingredients ?? []).map((i) => ({
        itemCodeableConcept: { coding: [{ system: SYS.KFA, code: i.kfaCode, display: i.name }] },
        isActive: true,
        strength: {
          numerator: strengthQuantity(i.amount, i.amountUnit),
          denominator: strengthQuantity(i.perAmount, i.perUnit),
        },
      })),
      ...medicationBatch(batch),
      extension: [medicationTypeExtension(item.compoundType ?? 'SD')],
    };
  }

  static toMedicationRequest(
    item: PrescriptionItem,
    kfa: KfaProduct | null,
    medicationId: string,
    encounter: Encounter,
    ctx: FhirContext,
  ) {
    const text = [
      item.dosage,
      item.frequency,
      item.duration ? `selama ${item.duration}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    const quantity = leadingNumber(item.quantity);
    const days = durationDays(item.duration);
    return {
      resourceType: 'MedicationRequest',
      identifier: [
        {
          system: ids('prescription', ctx.orgId),
          use: 'official',
          value: String(encounter.id),
        },
        {
          system: ids('prescription-item', ctx.orgId),
          use: 'official',
          value: `${encounter.id}-${item.id}`,
        },
      ],
      status: encounter.status === 'cancelled' ? 'cancelled' : 'completed',
      intent: 'order',
      category: [
        {
          coding: [
            {
              system: SYS.MEDREQ_CATEGORY,
              code: 'outpatient',
              display: 'Outpatient',
            },
          ],
        },
      ],
      priority: 'routine',
      medicationReference: {
        reference: `Medication/${medicationId}`,
        display: kfa?.name ?? item.drugName,
      },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      authoredOn: fhirDateTime(item.createdAt),
      requester: practitionerRef(ctx),
      dosageInstruction: [
        {
          sequence: 1,
          text: text || item.drugName,
          ...(item.instructions
            ? { patientInstruction: item.instructions }
            : {}),
          ...routeOf(item, kfa),
        },
      ],
      dispenseRequest: {
        ...(quantity ? { quantity: dispenseQuantity(item, kfa, quantity) } : {}),
        ...(days
          ? {
              expectedSupplyDuration: {
                value: days,
                unit: 'days',
                system: SYS.UCUM,
                code: 'd',
              },
            }
          : {}),
        performer: { reference: `Organization/${ctx.orgId}` },
      },
    };
  }

  // ── 03. Anamnesis (data pasien) ───────────────────────────────────────

  private static observation(
    ctx: FhirContext,
    when: string | undefined,
    category: [string, string],
    code: { system: string } & Coding,
    value: Record<string, unknown>,
    extra: Record<string, unknown> = {},
  ) {
    return {
      resourceType: 'Observation',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: SYS.OBS_CATEGORY,
              code: category[0],
              display: category[1],
            },
          ],
        },
      ],
      code: { coding: [code] },
      subject: patientRef(ctx),
      performer: [practitionerRef(ctx)],
      encounter: encounterRef(ctx),
      effectiveDateTime: when,
      issued: when,
      ...extra,
      ...value,
    };
  }

  /** Golongan darah & rhesus pasien (Postman "03. Golongan Darah / Rhesus"). */
  static toBloodObservations(
    patient: Patient,
    ctx: FhirContext,
    when: Date,
  ): LinkedResource[] {
    const t = fhirDateTime(when);
    const out: LinkedResource[] = [];
    const ABO: Record<string, [string, string]> = {
      A: ['LA19710-5', 'Group A'],
      B: ['LA19709-7', 'Group B'],
      AB: ['LA28449-9', 'Group AB'],
      O: ['LA19708-9', 'Group O'],
    };
    const abo = patient.golonganDarah
      ? ABO[String(patient.golonganDarah).toUpperCase()]
      : undefined;
    if (abo) {
      out.push({
        localType: 'pt_blood_type',
        localId: patient.id,
        resource: this.observation(
          ctx,
          t,
          ['laboratory', 'Laboratory'],
          {
            system: SYS.LOINC,
            code: '883-9',
            display: 'ABO group [Type] in Blood',
          },
          {
            valueCodeableConcept: {
              coding: [{ system: SYS.LOINC, code: abo[0], display: abo[1] }],
            },
          },
        ),
      });
    }
    const rh = String(patient.rhesus ?? '').toLowerCase();
    const rhCode: [string, string] | null =
      rh === '+' || rh.startsWith('pos')
        ? ['LA6576-8', 'Positive']
        : rh === '-' || rh.startsWith('neg')
          ? ['LA6577-6', 'Negative']
          : null;
    if (rhCode) {
      out.push({
        localType: 'pt_rhesus',
        localId: patient.id,
        resource: this.observation(
          ctx,
          t,
          ['laboratory', 'Laboratory'],
          { system: SYS.LOINC, code: '10331-7', display: 'Rh [Type] in Blood' },
          {
            valueCodeableConcept: {
              coding: [
                { system: SYS.LOINC, code: rhCode[0], display: rhCode[1] },
              ],
            },
          },
        ),
      });
    }
    return out;
  }

  /** Riwayat penyakit sistemik (Postman "03. Riwayat Penyakit"). */
  static toHistoryConditions(
    patient: Patient,
    ctx: FhirContext,
    when: Date,
  ): LinkedResource[] {
    const t = fhirDateTime(when);
    const make = (
      localType: string,
      coding: Coding,
      text?: string,
    ): LinkedResource => ({
      localType,
      localId: patient.id,
      resource: {
        resourceType: 'Condition',
        clinicalStatus: {
          coding: [
            { system: SYS.COND_CLINICAL, code: 'active', display: 'Active' },
          ],
        },
        category: [
          {
            coding: [
              {
                system: SYS.COND_CATEGORY,
                code: 'problem-list-item',
                display: 'Problem List Item',
              },
            ],
          },
        ],
        code: {
          coding: [{ system: SYS.SNOMED, ...coding }],
          ...(text ? { text } : {}),
        },
        subject: patientRef(ctx),
        encounter: encounterRef(ctx),
        recordedDate: t,
      },
    });
    const out: LinkedResource[] = [];
    for (const [field, coding] of Object.entries(HISTORY_CONDITION)) {
      if ((patient as unknown as Record<string, unknown>)[field]) {
        out.push(make(`pt_hist_${field}`.slice(0, 50), coding));
      }
    }
    if (
      patient.riwayatSistemikLainnya &&
      patient.catatanSistemikLainnya?.trim()
    ) {
      out.push(
        make(
          'pt_hist_lainnya',
          {
            code: '417662000',
            display: 'History of clinical finding in subject',
          },
          patient.catatanSistemikLainnya.trim(),
        ),
      );
    }
    return out;
  }

  /** Riwayat alergi (Postman "03. Riwayat Alergi"). */
  static toAllergies(
    patient: Patient,
    ctx: FhirContext,
    when: Date,
  ): LinkedResource[] {
    if (!patient.punyaAlergi && !patient.alergiObat && !patient.alergiMakanan)
      return [];
    const t = fhirDateTime(when);
    const note = patient.catatanAlergi?.trim();
    const make = (
      localType: string,
      coding: Coding,
      category: string[],
    ): LinkedResource => ({
      localType,
      localId: patient.id,
      resource: {
        resourceType: 'AllergyIntolerance',
        clinicalStatus: {
          coding: [
            { system: SYS.ALLERGY_CLINICAL, code: 'active', display: 'Active' },
          ],
        },
        verificationStatus: {
          coding: [
            {
              system: SYS.ALLERGY_VERIFICATION,
              code: 'unconfirmed',
              display: 'Unconfirmed',
            },
          ],
        },
        ...(category.length ? { category } : {}),
        code: {
          coding: [{ system: SYS.SNOMED, ...coding }],
          ...(note ? { text: note } : {}),
        },
        patient: patientRef(ctx),
        encounter: encounterRef(ctx),
        recordedDate: t,
        recorder: practitionerRef(ctx),
      },
    });
    const out: LinkedResource[] = [];
    if (patient.alergiObat)
      out.push(make('pt_allergy_drug', ALLERGY.drug, ['medication']));
    if (patient.alergiMakanan)
      out.push(make('pt_allergy_food', ALLERGY.food, ['food']));
    if (!out.length) out.push(make('pt_allergy_other', ALLERGY.other, []));
    return out;
  }

  /** Keluhan utama terkode SNOMED (Postman "03. Keluhan Utama"). */
  static toChiefComplaint(
    code: Coding,
    text: string | null,
    recordedAt: Date,
    ctx: FhirContext,
  ) {
    const t = fhirDateTime(recordedAt);
    return {
      resourceType: 'Condition',
      clinicalStatus: {
        coding: [
          { system: SYS.COND_CLINICAL, code: 'active', display: 'Active' },
        ],
      },
      category: [
        {
          coding: [
            {
              system: SYS.COND_CATEGORY,
              code: 'problem-list-item',
              display: 'Problem List Item',
            },
          ],
        },
      ],
      code: {
        coding: [{ system: SYS.SNOMED, ...code }],
        ...(text ? { text } : {}),
      },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      onsetDateTime: t,
      recordedDate: t,
    };
  }

  // ── 04. Pemeriksaan fisik: kesadaran & nyeri ──────────────────────────

  static toConsciousnessAndPain(
    pe: PhysicalExamination,
    ctx: FhirContext,
  ): LinkedResource[] {
    const t = fhirDateTime(pe.updatedAt ?? pe.createdAt);
    const out: LinkedResource[] = [];
    const level = pe.consciousness
      ? CONSCIOUSNESS[pe.consciousness.trim().toLowerCase()]
      : undefined;
    if (level) {
      out.push({
        localType: 'pe_consciousness',
        localId: pe.id,
        resource: this.observation(
          ctx,
          t,
          ['exam', 'Exam'],
          {
            system: SYS.LOINC,
            code: '67775-7',
            display: 'Level of responsiveness',
          },
          {
            valueCodeableConcept: {
              coding: [{ system: SYS.SNOMED, ...level }],
              text: pe.consciousness,
            },
          },
        ),
      });
    }
    if (isFilled(pe.painScale)) {
      out.push({
        localType: 'pe_pain',
        localId: pe.id,
        resource: this.observation(
          ctx,
          t,
          ['survey', 'Survey'],
          {
            system: SYS.LOINC,
            code: '72514-3',
            display:
              'Pain severity - 0-10 verbal numeric rating [Score] - Reported',
          },
          {
            valueQuantity: {
              value: Number(pe.painScale),
              unit: '{score}',
              system: SYS.UCUM,
              code: '{score}',
            },
          },
        ),
      });
    }
    return out;
  }

  // ── 05. Odontogram ────────────────────────────────────────────────────

  /**
   * Satu Observation "Pemeriksaan Odontogram" per gigi yang punya temuan
   * (Postman "05. Odontogram"), plus DMF-T dan catatan kondisi lain.
   * Odontogram adalah grafik pasien; dikirim sebagai potret saat kunjungan.
   */
  static toOdontogram(
    teeth: ToothCondition[],
    bridges: DentalBridge[],
    encounterId: number,
    when: Date,
    ctx: FhirContext,
  ): LinkedResource[] {
    const t = fhirDateTime(when);
    const surfaceCode = (key: string, fdi: number): Coding =>
      key === 'vestibular'
        ? isAnteriorTooth(fdi)
          ? SURFACE_SNOMED.labial
          : SURFACE_SNOMED.buccal
        : SURFACE_SNOMED[key as keyof typeof SURFACE_SNOMED];
    const SURFACES: [keyof ToothCondition, string][] = [
      ['surfaceMesial', 'mesial'],
      ['surfaceDistal', 'distal'],
      ['surfaceVestibular', 'vestibular'],
      ['surfaceLingual', 'lingual'],
      ['surfaceOcclusal', 'occlusal'],
    ];
    const SURFACE_COMPONENT = {
      system: SYS.LOINC,
      code: '32889-8',
      display: 'Surface [Identifier] Tooth',
    };

    const out: LinkedResource[] = [];
    let decayed = 0;
    let missing = 0;
    let filled = 0;

    for (const tooth of [...teeth].sort(
      (a, b) => a.toothNumber - b.toothNumber,
    )) {
      const site = TOOTH_SNOMED[tooth.toothNumber];
      if (!site) continue;
      const components: Record<string, unknown>[] = [];
      let hasCaries = false;
      let hasFilling = false;

      for (const [field, key] of SURFACES) {
        const value = String(tooth[field] ?? '').toLowerCase();
        if (!value) continue;
        const surface = {
          coding: [
            { system: SYS.SNOMED, ...surfaceCode(key, tooth.toothNumber) },
          ],
        };
        if (value === 'karies') {
          hasCaries = true;
          components.push(
            {
              code: { coding: [SURFACE_COMPONENT] },
              valueCodeableConcept: surface,
            },
            {
              code: { coding: [{ system: SYS.SNOMED, ...TOOTH_FINDING }] },
              valueCodeableConcept: {
                coding: [{ system: SYS.SNOMED, ...DENTAL_CARIES }],
              },
            },
          );
        } else if (value === 'komposit' || value === 'gic') {
          hasFilling = true;
          components.push(
            {
              code: { coding: [SURFACE_COMPONENT] },
              valueCodeableConcept: surface,
            },
            {
              code: {
                coding: [{ system: SYS.SNOMED, ...DENTAL_FILLING_MATERIAL }],
              },
              valueCodeableConcept:
                value === 'komposit'
                  ? { coding: [{ system: SYS.SNOMED, ...COMPOSITE_FILLING }] }
                  : { text: 'Glass ionomer cement (GIC)' },
            },
          );
        }
      }

      for (const annotation of [tooth.teksAtas, tooth.teksBawah]) {
        const a = annotation
          ? TOOTH_ANNOTATION[String(annotation).toUpperCase()]
          : undefined;
        if (!a) continue;
        if (String(annotation).toUpperCase() === 'MISSING') missing++;
        components.push({
          code: { coding: [{ system: SYS.SNOMED, ...TOOTH_FINDING }] },
          valueCodeableConcept: a.coding
            ? {
                coding: [
                  {
                    system:
                      a.system === 'snomed' ? SYS.SNOMED : SYS.CLINICAL_TERM,
                    ...a.coding,
                  },
                ],
                text: a.text,
              }
            : { text: a.text },
        });
      }
      if (tooth.rct) {
        components.push({
          code: { coding: [{ system: SYS.SNOMED, ...TOOTH_FINDING }] },
          valueCodeableConcept: { text: 'Perawatan saluran akar (RCT)' },
        });
      }
      const bridge = bridges.find(
        (b) =>
          tooth.toothNumber >= Math.min(b.fromTooth, b.toTooth) &&
          tooth.toothNumber <= Math.max(b.fromTooth, b.toTooth),
      );
      if (bridge) {
        components.push({
          code: {
            coding: [
              {
                system: SYS.LOINC,
                code: '34026-5',
                display: 'Dental prosthesis',
              },
            ],
          },
          valueCodeableConcept: { text: bridge.label || 'Gigi tiruan cekat' },
        });
      }
      if (!components.length) continue;

      const isPermanent = tooth.toothNumber < 50;
      if (isPermanent && hasCaries) decayed++;
      else if (isPermanent && hasFilling) filled++;

      out.push({
        localType: `odo_${tooth.toothNumber}`,
        localId: encounterId,
        resource: this.observation(
          ctx,
          t,
          ['exam', 'Exam'],
          {
            system: SYS.CLINICAL_TERM,
            code: 'OC000061',
            display: 'Pemeriksaan Odontogram',
          },
          { valueBoolean: true },
          {
            bodySite: { coding: [{ system: SYS.SNOMED, ...site }] },
            component: components,
          },
        ),
      });
    }

    if (teeth.length) {
      for (const [key, value] of [
        ['decayed', decayed],
        ['missing', missing],
        ['filled', filled],
      ] as const) {
        out.push({
          localType: `dmf_${key}`,
          localId: encounterId,
          resource: this.observation(
            ctx,
            t,
            ['exam', 'Exam'],
            { system: SYS.SNOMED, ...DMF_COUNT[key] },
            { valueInteger: value },
          ),
        });
      }
    }
    return out;
  }

  /** Kondisi gigi dan mulut lainnya (catatan pemeriksaan gigi). */
  static toOralNotes(
    de: DentalExamination,
    ctx: FhirContext,
  ): LinkedResource[] {
    if (!de.notes?.trim()) return [];
    return [
      {
        localType: 'dental_notes',
        localId: de.id,
        resource: this.observation(
          ctx,
          fhirDateTime(de.updatedAt ?? de.createdAt),
          ['exam', 'Exam'],
          {
            system: SYS.CLINICAL_TERM,
            code: 'OC000060',
            display: 'Kondisi Gigi dan Mulut Lainnya',
          },
          { valueString: de.notes.trim() },
        ),
      },
    ];
  }

  // ── 09. Edukasi, 10. Tindak lanjut, 11. Kondisi pulang ────────────────

  static toEducation(
    given: boolean,
    encounter: Encounter,
    ctx: FhirContext,
    reasons: SoapDiagnosis[],
  ) {
    const at = fhirDateTime(
      encounter.finishedTime ??
        encounter.inProgressTime ??
        encounter.arrivedTime,
    );
    return {
      resourceType: 'Procedure',
      status: given ? 'completed' : 'not-done',
      category: { coding: [{ system: SYS.SNOMED, ...EDUCATION }] },
      code: {
        coding: [
          { system: SYS.SNOMED, ...(given ? DISEASE_EDUCATION : EDUCATION) },
        ],
      },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      performedPeriod: { start: at, end: at },
      ...(given ? { performer: [{ actor: practitionerRef(ctx) }] } : {}),
      ...(given && reasons.length
        ? {
            reasonCode: reasons.map((r) => ({
              coding: [
                {
                  system: r.system === 'snomed' ? SYS.SNOMED : SYS.ICD10,
                  code: r.code,
                  display: r.display,
                },
              ],
            })),
          }
        : {}),
      ...(given
        ? {
            note: [
              {
                text: 'Edukasi terkait proses penyakit, diagnosis, dan rencana asuhan',
              },
            ],
          }
        : {}),
    };
  }

  static toFollowUp(
    text: string,
    encounter: Encounter,
    ctx: FhirContext,
    reasons: SoapDiagnosis[],
    dueDate?: string | null,
  ) {
    const authored = fhirDateTime(
      encounter.finishedTime ?? encounter.updatedAt,
    );
    return {
      resourceType: 'ServiceRequest',
      identifier: [
        {
          system: ids('servicerequest', ctx.orgId),
          value: `KONTROL-${encounter.id}`,
        },
      ],
      status: 'active',
      intent: 'original-order',
      priority: 'routine',
      category: [
        { coding: [{ system: SYS.SNOMED, ...SELF_REFERRAL }] },
        { coding: [{ system: SYS.SNOMED, ...CONSULTATION }] },
      ],
      code: { coding: [{ system: SYS.SNOMED, ...FOLLOW_UP_VISIT }], text },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      occurrenceDateTime: dueDate
        ? fhirDateTime(`${dueDate}T09:00:00+07:00`)
        : authored,
      authoredOn: authored,
      requester: practitionerRef(ctx),
      performer: [practitionerRef(ctx)],
      ...(reasons.length
        ? {
            reasonCode: reasons.map((r) => ({
              coding: [
                {
                  system: r.system === 'snomed' ? SYS.SNOMED : SYS.ICD10,
                  code: r.code,
                  display: r.display,
                },
              ],
            })),
          }
        : {}),
      locationCode: [
        {
          coding: [
            {
              system: SYS.ROLE_CODE,
              code: 'OF',
              display: 'Outpatient Facility',
            },
          ],
        },
      ],
      patientInstruction: text,
    };
  }

  static toDischargeCondition(
    condition: string,
    encounter: Encounter,
    ctx: FhirContext,
  ) {
    const coding = DISCHARGE_CONDITION[condition];
    if (!coding) return null;
    return {
      resourceType: 'Condition',
      identifier: [
        {
          system: ids('condition', ctx.orgId),
          value: `PULANG-${encounter.id}`,
        },
      ],
      clinicalStatus: {
        coding: [
          { system: SYS.COND_CLINICAL, code: 'active', display: 'Active' },
        ],
      },
      category: [
        {
          coding: [
            {
              system: SYS.COND_CATEGORY,
              code: 'problem-list-item',
              display: 'Problem List Item',
            },
          ],
        },
      ],
      code: { coding: [{ system: SYS.SNOMED, ...coding }] },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      recordedDate: fhirDateTime(encounter.finishedTime ?? encounter.updatedAt),
    };
  }

  // ── Dokter umum: pemeriksaan head-to-toe, fungsional, kesimpulan klinis ──

  /** Pemeriksaan fisik head-to-toe (Playbook bab 4) — satu Observation per bagian tubuh terisi. */
  static toHeadToToe(
    pe: PhysicalExamination,
    ctx: FhirContext,
  ): LinkedResource[] {
    const t = fhirDateTime(pe.updatedAt ?? pe.createdAt);
    const values = pe as unknown as Record<string, unknown>;
    const out: LinkedResource[] = [];
    for (const [part, spec] of Object.entries(HEAD_TO_TOE)) {
      const lines = spec.fields
        .map((f) => {
          const v = values[f.key];
          const text = typeof v === 'string' ? v.trim() : '';
          return text ? (f.label ? `${f.label}: ${text}` : text) : '';
        })
        .filter(Boolean);
      if (!lines.length) continue;
      const coding = [
        { system: SYS.LOINC, ...spec.loinc },
        ...(spec.site ? [{ system: SYS.SNOMED, ...spec.site }] : []),
      ];
      out.push({
        localType: `pe_exam_${part}`,
        localId: pe.id,
        resource: {
          ...this.observation(ctx, t, ['exam', 'Exam'], coding[0], {
            valueString: lines.join('; '),
          }),
          code: { coding },
        },
      });
    }
    return out;
  }

  /** Status psikologis (bab 5) & status kehamilan pasien perempuan. */
  static toFunctionalStatus(
    pe: PhysicalExamination,
    ctx: FhirContext,
  ): LinkedResource[] {
    const t = fhirDateTime(pe.updatedAt ?? pe.createdAt);
    const out: LinkedResource[] = [];
    const psych = pe.psychologicalStatus
      ? PSYCHOLOGICAL_STATUS[pe.psychologicalStatus]
      : undefined;
    if (psych) {
      const note = pe.psychologicalNote?.trim();
      out.push({
        localType: 'pe_psychological',
        localId: pe.id,
        resource: this.observation(
          ctx,
          t,
          ['survey', 'Survey'],
          { system: SYS.LOINC, code: '8693-4', display: 'Mental Status' },
          {
            valueCodeableConcept: {
              coding: [{ system: SYS.SNOMED, ...psych }],
              ...(note ? { text: note } : {}),
            },
          },
        ),
      });
    }
    const preg = pe.pregnancyStatus
      ? PREGNANCY_STATUS[pe.pregnancyStatus]
      : undefined;
    if (preg) {
      out.push({
        localType: 'pe_pregnancy',
        localId: pe.id,
        resource: this.observation(
          ctx,
          t,
          ['survey', 'Survey'],
          { system: SYS.LOINC, code: '82810-3', display: 'Pregnancy status' },
          {
            valueCodeableConcept: { coding: [{ system: SYS.SNOMED, ...preg }] },
          },
        ),
      });
    }
    return out;
  }

  private static clinicalImpression(
    ctx: FhirContext,
    when: string | undefined,
    code: { system: string } & Coding,
    extra: Record<string, unknown>,
    problems: string[],
  ) {
    return {
      resourceType: 'ClinicalImpression',
      status: 'completed',
      code: { coding: [code] },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      effectiveDateTime: when,
      date: when,
      assessor: practitionerRef(ctx),
      ...(problems.length
        ? { problem: problems.map((id) => ({ reference: `Condition/${id}` })) }
        : {}),
      ...extra,
    };
  }

  /**
   * Riwayat perjalanan penyakit (bab 6, dari Subjektif), rasional klinis
   * (bab 12, dari Asesmen) dan prognosis (bab 22). `problems` = ID
   * Condition diagnosis di SATUSEHAT.
   */
  static toClinicalImpressions(
    soap: {
      subjective?: string | null;
      assessment?: string | null;
      prognosis?: string | null;
      id: number;
    },
    when: Date,
    ctx: FhirContext,
    problems: string[],
  ): LinkedResource[] {
    const t = fhirDateTime(when);
    const out: LinkedResource[] = [];
    const subjective = soap.subjective?.trim();
    if (subjective) {
      out.push({
        localType: 'soap_history',
        localId: soap.id,
        resource: this.clinicalImpression(
          ctx,
          t,
          { system: SYS.SNOMED, ...HISTORY_OF_DISORDER },
          { summary: subjective },
          [],
        ),
      });
    }
    const assessment = soap.assessment?.trim();
    if (assessment) {
      out.push({
        localType: 'soap_rationale',
        localId: soap.id,
        resource: this.clinicalImpression(
          ctx,
          t,
          { system: SYS.KEMKES_TERM, ...CLINICAL_RATIONALE },
          { summary: assessment },
          problems,
        ),
      });
    }
    const prognosis = soap.prognosis
      ? PROGNOSIS[soap.prognosis as keyof typeof PROGNOSIS]
      : undefined;
    if (prognosis) {
      out.push({
        localType: 'soap_prognosis',
        localId: soap.id,
        resource: this.clinicalImpression(
          ctx,
          t,
          { system: SYS.SNOMED, ...DETERMINATION_OF_PROGNOSIS },
          {
            prognosisCodeableConcept: [
              { coding: [{ system: SYS.SNOMED, ...prognosis }] },
            ],
          },
          problems,
        ),
      });
    }
    return out;
  }

  /** Rencana rawat (bab 8, dari Plan) & instruksi medik (bab 9, dari Tata laksana). */
  static toCarePlans(
    soap: { plan?: string | null; treatment?: string | null; id: number },
    when: Date,
    ctx: FhirContext,
  ): LinkedResource[] {
    const t = fhirDateTime(when);
    const make = (
      localType: string,
      title: string,
      description: string,
    ): LinkedResource => ({
      localType,
      localId: soap.id,
      resource: {
        resourceType: 'CarePlan',
        status: 'active',
        intent: 'plan',
        category: [
          { coding: [{ system: SYS.SNOMED, ...OUTPATIENT_CARE_PLAN }] },
        ],
        title,
        description,
        subject: patientRef(ctx),
        encounter: encounterRef(ctx),
        created: t,
        author: practitionerRef(ctx),
      },
    });
    const out: LinkedResource[] = [];
    if (soap.plan?.trim())
      out.push(
        make('soap_care_plan', 'Rencana Rawat Pasien', soap.plan.trim()),
      );
    if (soap.treatment?.trim()) {
      out.push(
        make(
          'soap_instruction',
          'Instruksi Medik dan Keperawatan Pasien',
          soap.treatment.trim(),
        ),
      );
    }
    return out;
  }

  // ── 18–19. Pengeluaran & pemberian obat, 17. pengkajian resep ─────────

  /** Obat diserahkan ke pasien (Postman "MedicationDispense - Create"). */
  static toMedicationDispense(
    item: PrescriptionItem,
    kfa: KfaProduct | null,
    refs: { medicationId: string; requestId: string },
    encounter: Encounter,
    ctx: FhirContext,
  ) {
    const at = fhirDateTime(item.dispensedAt);
    const quantity = leadingNumber(item.quantity);
    const days = durationDays(item.duration);
    const text = [item.dosage, item.frequency, item.duration ? `selama ${item.duration}` : null]
      .filter(Boolean)
      .join(', ');
    return {
      resourceType: 'MedicationDispense',
      identifier: [
        { system: ids('prescription', ctx.orgId), use: 'official', value: String(encounter.id) },
        { system: ids('prescription-item', ctx.orgId), use: 'official', value: `${encounter.id}-${item.id}` },
      ],
      status: 'completed',
      category: {
        coding: [
          {
            system: 'http://terminology.hl7.org/fhir/CodeSystem/medicationdispense-category',
            code: 'outpatient',
            display: 'Outpatient',
          },
        ],
      },
      medicationReference: { reference: `Medication/${refs.medicationId}`, display: kfa?.name ?? item.drugName },
      subject: patientRef(ctx),
      context: encounterRef(ctx),
      performer: [{ actor: practitionerRef(ctx) }],
      location: { reference: `Location/${ctx.location.id}`, display: ctx.location.name },
      authorizingPrescription: [{ reference: `MedicationRequest/${refs.requestId}` }],
      ...(quantity ? { quantity: dispenseQuantity(item, kfa, quantity) } : {}),
      ...(days ? { daysSupply: { value: days, unit: 'days', system: SYS.UCUM, code: 'd' } } : {}),
      whenPrepared: at,
      whenHandedOver: at,
      dosageInstruction: [
        {
          sequence: 1,
          text: text || item.drugName,
          ...(item.instructions ? { patientInstruction: item.instructions } : {}),
          ...routeOf(item, kfa),
        },
      ],
    };
  }

  /** Obat diberikan langsung di klinik (Playbook bab 19). */
  static toMedicationAdministration(
    item: PrescriptionItem,
    kfa: KfaProduct | null,
    refs: { medicationId: string; requestId: string },
    ctx: FhirContext,
  ) {
    const at = fhirDateTime(item.administeredAt);
    const dose = leadingNumber(item.administeredDose);
    const doseUnit = item.administeredDose?.replace(/^[\d.,\s]+/, '').trim();
    return {
      resourceType: 'MedicationAdministration',
      identifier: [{ system: ids('medicationadministration', ctx.orgId), value: `ADM-${item.id}` }],
      status: 'completed',
      category: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/medication-admin-category',
            code: 'outpatient',
            display: 'Outpatient',
          },
        ],
      },
      medicationReference: { reference: `Medication/${refs.medicationId}`, display: kfa?.name ?? item.drugName },
      subject: patientRef(ctx),
      context: encounterRef(ctx),
      effectivePeriod: { start: at, end: at },
      performer: [{ actor: practitionerRef(ctx) }],
      request: { reference: `MedicationRequest/${refs.requestId}` },
      dosage: {
        text: item.administeredDose || item.dosage || item.drugName,
        ...routeOf(item, kfa),
        ...(dose ? { dose: { value: dose, ...(doseUnit ? { unit: doseUnit } : {}) } } : {}),
      },
    };
  }

  /** Pengkajian resep (QuestionnaireResponse Q0007). */
  static toPrescriptionReview(
    review: PrescriptionReview,
    requestIds: string[],
    ctx: FhirContext,
  ) {
    const coded = (v: unknown) =>
      v === 'tidak_sesuai'
        ? { valueCoding: { system: SYS.CLINICAL_TERM, code: 'OV000053', display: 'Tidak Sesuai' } }
        : { valueCoding: { system: SYS.CLINICAL_TERM, code: 'OV000052', display: 'Sesuai' } };
    return {
      resourceType: 'QuestionnaireResponse',
      questionnaire: PRESCRIPTION_REVIEW_QUESTIONNAIRE,
      status: 'completed',
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      authored: fhirDateTime(review.reviewedAt),
      author: practitionerRef(ctx),
      source: { reference: `Patient/${ctx.patient.id}` },
      item: [
        ...PRESCRIPTION_REVIEW_GROUPS.map((g) => ({
          linkId: g.linkId,
          text: g.text,
          item: g.items.map((q) => ({
            linkId: q.linkId,
            text: q.text,
            answer: [
              q.kind === 'boolean'
                ? { valueBoolean: review.answers[q.linkId] === true }
                : coded(review.answers[q.linkId]),
            ],
          })),
        })),
        {
          linkId: '4',
          text: 'Resep yang dilakukan pengkajian resep',
          answer: requestIds.map((id) => ({ valueReference: { reference: `MedicationRequest/${id}` } })),
        },
      ],
    };
  }

  // ── 7. Tujuan perawatan, 14. Penilaian risiko, 20. Diet ──────────────

  static toGoal(goal: SoapGoal, soapId: number, when: Date, ctx: FhirContext, conditionIds: string[]) {
    return {
      resourceType: 'Goal',
      identifier: [{ system: ids('goal', ctx.orgId), value: `GOAL-${soapId}` }],
      lifecycleStatus: 'planned',
      category: [
        {
          coding: [
            { system: 'http://terminology.hl7.org/CodeSystem/goal-category', code: 'nursing', display: 'Nursing' },
          ],
        },
      ],
      description: {
        ...(goal.code
          ? { coding: [{ system: SYS.SNOMED, code: goal.code, ...(goal.display ? { display: goal.display } : {}) }] }
          : {}),
        text: goal.text,
      },
      subject: patientRef(ctx),
      startDate: fhirDateTime(when)?.slice(0, 10),
      ...(goal.dueDate ? { target: [{ dueDate: goal.dueDate }] } : {}),
      statusDate: fhirDateTime(when)?.slice(0, 10),
      expressedBy: practitionerRef(ctx),
      ...(conditionIds.length ? { addresses: conditionIds.map((id) => ({ reference: `Condition/${id}` })) } : {}),
    };
  }

  static toRiskAssessment(risk: SoapRisk, soapId: number, when: Date, ctx: FhirContext, conditionIds: string[]) {
    const level = {
      negligible: 'Negligible likelihood',
      low: 'Low likelihood',
      moderate: 'Moderate likelihood',
      high: 'High likelihood',
      certain: 'Certain',
    }[risk.level];
    return {
      resourceType: 'RiskAssessment',
      identifier: [{ system: ids('riskassessment', ctx.orgId), value: `RISK-${soapId}` }],
      status: 'final',
      code: { coding: [{ system: SYS.SNOMED, code: risk.code, display: risk.display }] },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      occurrenceDateTime: fhirDateTime(when),
      ...(conditionIds[0] ? { condition: { reference: `Condition/${conditionIds[0]}` } } : {}),
      performer: practitionerRef(ctx),
      ...(conditionIds.length ? { reasonReference: conditionIds.map((id) => ({ reference: `Condition/${id}` })) } : {}),
      prediction: [
        {
          ...(risk.outcomeCode
            ? {
                outcome: {
                  coding: [
                    { system: SYS.SNOMED, code: risk.outcomeCode, ...(risk.outcomeDisplay ? { display: risk.outcomeDisplay } : {}) },
                  ],
                },
              }
            : {}),
          qualitativeRisk: {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/risk-probability', code: risk.level, display: level }],
          },
        },
      ],
      ...(risk.mitigation ? { mitigation: risk.mitigation } : {}),
      ...(risk.note ? { note: [{ text: risk.note }] } : {}),
    };
  }

  static toNutritionOrder(diet: SoapDiet, soapId: number, when: Date, ctx: FhirContext) {
    return {
      resourceType: 'NutritionOrder',
      identifier: [{ system: ids('nutritionorder', ctx.orgId), value: `DIET-${soapId}` }],
      status: 'active',
      intent: diet.intent,
      patient: patientRef(ctx),
      encounter: encounterRef(ctx),
      dateTime: fhirDateTime(when),
      orderer: practitionerRef(ctx),
      oralDiet: {
        type: diet.types.map((t) => ({ coding: [{ system: t.system, code: t.code, display: t.display }] })),
        ...(diet.note ? { instruction: diet.note } : {}),
      },
      ...(diet.note ? { note: [{ text: diet.note }] } : {}),
    };
  }

  // ── 28. Resume medis ──────────────────────────────────────────────────

  /**
   * Resume medis rawat jalan (Composition 88645-7) yang mereferensikan
   * resource yang sudah terkirim untuk kunjungan ini, per section bab 28.
   * `refs` = "ResourceType/id" per kelompok.
   */
  static toResume(
    encounter: Encounter,
    refs: Record<ResumeGroup, string[]>,
    ctx: FhirContext,
    hospitalCourse: string,
  ) {
    const KEMKES = 'http://terminology.kemkes.go.id';
    const entries = (g: ResumeGroup) => refs[g].map((reference) => ({ reference }));
    const sub = (title: string, code: string, display: string, g: ResumeGroup) =>
      refs[g].length ? [{ title, code: { coding: [{ system: SYS.LOINC, code, display }] }, entry: entries(g) }] : [];
    const section = (
      title: string,
      system: string,
      code: string,
      display: string,
      body: { entry?: { reference: string }[]; section?: unknown[] },
    ) =>
      (body.entry?.length || body.section?.length)
        ? [{ title, code: { coding: [{ system, code, display }] }, ...body }]
        : [];
    const sections = [
      ...section('Anamnesis', KEMKES, 'TK000003', 'Anamnesis', {
        section: [
          ...sub('Keluhan Utama', '10154-3', 'Chief complaint Narrative - Reported', 'chiefComplaint'),
          ...sub('Riwayat Alergi', '48765-2', 'Allergies', 'allergy'),
          ...sub('Riwayat Penyakit Pribadi Sekarang', '10164-2', 'History of Present illness Narrative', 'history'),
        ],
      }),
      ...section('Pemeriksaan Fisik', KEMKES, 'TK000007', 'Pemeriksaan Fisik', {
        section: [
          ...sub('Tanda Vital', '8716-3', 'Vital signs', 'vitals'),
          ...sub('Pemeriksaan Fisik Head to Toe', '10187-3', 'Review of systems Narrative - Reported', 'exam'),
        ],
      }),
      ...section('Pemeriksaan Fungsional', SYS.LOINC, '47420-5', 'Functional status assessment note', {
        entry: entries('functional'),
      }),
      ...section('Perencanaan Perawatan', SYS.LOINC, '18776-5', 'Plan of care note', { entry: entries('carePlan') }),
      ...section('Pemeriksaan Penunjang', KEMKES, 'TK000009', 'Hasil Pemeriksaan Penunjang', {
        section: [
          ...sub('Hasil Pemeriksaan Laboratorium', '11502-2', 'Laboratory report', 'lab'),
          ...sub('Hasil Pemeriksaan Radiologi', '18782-3', 'Radiology Study observation (narrative)', 'radiology'),
        ],
      }),
      ...section('Diagnosis', KEMKES, 'TK000004', 'Diagnosis', {
        section: [...sub('Diagnosis Akhir', '78375-3', 'Discharge diagnosis Narrative', 'diagnosis')],
      }),
      ...section('Tindakan/Prosedur Medis', KEMKES, 'TK000005', 'Tindakan/Prosedur Medis', {
        entry: entries('procedure'),
      }),
      ...section('Farmasi', KEMKES, 'TK000013', 'Obat', {
        section: [...sub('Obat Saat Kunjungan', '42346-7', 'Medications on admission (narrative)', 'medication')],
      }),
      ...section('Diet', SYS.LOINC, '42344-2', 'Discharge diet (narrative)', { entry: entries('diet') }),
      ...section('Edukasi', SYS.LOINC, '34895-3', 'Education note', { entry: entries('education') }),
      ...section('Kondisi Saat Meninggalkan Rumah Sakit', SYS.LOINC, '10184-0', 'Hospital discharge physical findings Narrative', {
        entry: entries('discharge'),
      }),
      ...section('Rencana Tindak Lanjut', SYS.LOINC, '8653-8', 'Hospital Discharge instructions', {
        entry: entries('followUp'),
      }),
      {
        title: 'Perjalanan Kunjungan Pasien',
        code: { coding: [{ system: SYS.LOINC, code: '8648-8', display: 'Hospital course Narrative' }] },
        text: { status: 'generated', div: `<div xmlns="http://www.w3.org/1999/xhtml">${escapeXml(hospitalCourse)}</div>` },
      },
    ];
    const date = fhirDateTime(encounter.finishedTime ?? encounter.updatedAt);
    return {
      resourceType: 'Composition',
      identifier: { system: ids('composition', ctx.orgId), value: `RESUME-${encounter.id}` },
      status: 'final',
      type: { coding: [{ system: SYS.LOINC, code: '88645-7', display: 'Outpatient hospital Discharge summary' }] },
      category: [{ coding: [{ system: SYS.LOINC, code: 'LP173421-1', display: 'Report' }] }],
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      date,
      author: [practitionerRef(ctx)],
      title: 'Resume Medis Rawat Jalan',
      attester: [{ mode: 'legal', time: date, party: practitionerRef(ctx) }],
      custodian: { reference: `Organization/${ctx.orgId}` },
      section: sections,
    };
  }
}
