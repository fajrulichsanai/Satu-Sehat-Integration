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
import { SoapDiagnosis } from '../../encounter-soap-notes/entities/encounter-soap-note.entity';
import { PrescriptionItem } from '../../prescriptions/entities/prescription-item.entity';
import { KfaProduct } from '../kfa/kfa.service';

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
  CLINICAL_TERM: 'http://terminology.kemkes.go.id/CodeSystem/clinical-term',
  MEDICATION_FORM: 'http://terminology.kemkes.go.id/CodeSystem/medication-form',
  MEDICATION_TYPE: 'http://terminology.kemkes.go.id/CodeSystem/medication-type',
  SERVICE_CLASS_OUTPATIENT:
    'http://terminology.kemkes.go.id/CodeSystem/locationServiceClass-Outpatient',
  UPGRADE_CLASS:
    'http://terminology.kemkes.go.id/CodeSystem/locationUpgradeClass',
} as const;

const ids = (kind: string, orgId: string) =>
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

const patientRef = (ctx: FhirContext) => ({
  reference: `Patient/${ctx.patient.id}`,
  display: ctx.patient.name,
});
const practitionerRef = (ctx: FhirContext) => ({
  reference: `Practitioner/${ctx.practitioner.id}`,
  display: ctx.practitioner.name,
});
const encounterRef = (ctx: FhirContext) => ({
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
      extension: [
        {
          url: 'https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType',
          valueCodeableConcept: {
            coding: [
              {
                system: SYS.MEDICATION_TYPE,
                code: 'NC',
                display: 'Non-compound',
              },
            ],
          },
        },
      ],
    };
  }

  static toMedicationRequest(
    item: PrescriptionItem,
    kfa: KfaProduct,
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
        display: kfa.name,
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
          ...(kfa.route
            ? {
                route: {
                  coding: [
                    {
                      system: SYS.ATC_ROUTE,
                      code: kfa.route.code,
                      display: kfa.route.name,
                    },
                  ],
                },
              }
            : {}),
        },
      ],
      dispenseRequest: {
        ...(quantity
          ? {
              quantity: {
                value: quantity,
                ...(kfa.uom ? { unit: kfa.uom } : {}),
              },
            }
          : {}),
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
}
