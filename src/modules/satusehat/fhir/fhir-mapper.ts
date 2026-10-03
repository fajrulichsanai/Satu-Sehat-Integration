/**
 * Pemetaan data ApexRecord → resource FHIR SATUSEHAT.
 *
 * Mengikuti Playbook Interoperabilitas "RME Rawat Jalan" dan koleksi Postman
 * resmi "24. Use Case - Gigi" (lihat file *.postman_collection.json di root
 * repo). Semua referensi Patient/Practitioner/Location/Encounter memakai ID
 * SATUSEHAT (IHS), bukan ID lokal.
 */
import { Encounter } from '../../encounters/entities/encounter.entity';
import { Diagnosis } from '../../diagnoses/entities/diagnosis.entity';
import { Procedure } from '../../procedures/entities/procedure.entity';
import { VitalSign } from '../../vital-sign/entities/vital-sign.entity';
import { Prescription } from '../../prescription/entities/prescription.entity';
import { Medication } from '../../medications/entities/medication.entity';
import { Dispense } from '../../dispense/entities/dispense.entity';
import { Location } from '../../location/entities/location.entity';
import {
  Anamnesis,
  BloodType,
  PregnancyStatus,
  Rhesus,
} from '../../anamnesis/entities/anamnesis.entity';

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
  MEDDISP_CATEGORY:
    'http://terminology.hl7.org/fhir/CodeSystem/medicationdispense-category',
  LOINC: 'http://loinc.org',
  SNOMED: 'http://snomed.info/sct',
  UCUM: 'http://unitsofmeasure.org',
  ICD10: 'http://hl7.org/fhir/sid/icd-10',
  ICD9CM: 'http://hl7.org/fhir/sid/icd-9-cm',
  KFA: 'http://sys-ids.kemkes.go.id/kfa',
  CLINICAL_TERM: 'http://terminology.kemkes.go.id/CodeSystem/clinical-term',
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

/** Vital sign: LOINC → display resmi + satuan UCUM */
const VITAL_SIGNS: Record<
  string,
  { display: string; unit: string; code: string }
> = {
  '8867-4': { display: 'Heart rate', unit: 'beats/minute', code: '/min' },
  '9279-1': {
    display: 'Respiratory rate',
    unit: 'breaths/minute',
    code: '/min',
  },
  '8480-6': {
    display: 'Systolic blood pressure',
    unit: 'mm[Hg]',
    code: 'mm[Hg]',
  },
  '8462-4': {
    display: 'Diastolic blood pressure',
    unit: 'mm[Hg]',
    code: 'mm[Hg]',
  },
  '8310-5': { display: 'Body temperature', unit: 'C', code: 'Cel' },
  '29463-7': { display: 'Body weight', unit: 'kg', code: 'kg' },
  '8302-2': { display: 'Body height', unit: 'cm', code: 'cm' },
  '59408-5': {
    display: 'Oxygen saturation in Arterial blood by Pulse oximetry',
    unit: '%',
    code: '%',
  },
};

const ENCOUNTER_STATUS: Record<string, string> = {
  arrived: 'arrived',
  in_progress: 'in-progress',
  finished: 'finished',
  cancelled: 'cancelled',
};

const PROCEDURE_STATUS: Record<string, string> = {
  preparation: 'preparation',
  in_progress: 'in-progress',
  completed: 'completed',
  not_done: 'not-done',
  stopped: 'stopped',
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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
   * Encounter rawat jalan. Status & statusHistory mengikuti waktu lokal:
   * arrived → in-progress → finished. Saat finished, `diagnosis` (rank 1 =
   * diagnosis primer) dan `hospitalization.dischargeDisposition` diisi.
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

  // ── 03. Anamnesis ─────────────────────────────────────────────────────

  /** Golongan darah, rhesus, status kehamilan (yang terisi saja). */
  static toAnamnesisObservations(anamnesis: Anamnesis, ctx: FhirContext) {
    const issued = fhirDateTime(anamnesis.createdAt);
    const base = (category: string, categoryDisplay: string) => ({
      resourceType: 'Observation',
      status: 'final',
      category: [
        {
          coding: [
            {
              system: SYS.OBS_CATEGORY,
              code: category,
              display: categoryDisplay,
            },
          ],
        },
      ],
      subject: patientRef(ctx),
      performer: [practitionerRef(ctx)],
      encounter: encounterRef(ctx),
      effectiveDateTime: issued,
      issued,
    });

    const out: { localType: string; resource: object }[] = [];

    const ABO: Record<BloodType, [string, string]> = {
      [BloodType.A]: ['LA19710-5', 'Group A'],
      [BloodType.B]: ['LA19709-7', 'Group B'],
      [BloodType.AB]: ['LA28449-9', 'Group AB'],
      [BloodType.O]: ['LA19708-9', 'Group O'],
    };
    if (anamnesis.golonganDarah && ABO[anamnesis.golonganDarah]) {
      const [code, display] = ABO[anamnesis.golonganDarah];
      out.push({
        localType: 'anamnesis_blood_type',
        resource: {
          ...base('laboratory', 'Laboratory'),
          code: {
            coding: [
              {
                system: SYS.LOINC,
                code: '883-9',
                display: 'ABO group [Type] in Blood',
              },
            ],
          },
          valueCodeableConcept: {
            coding: [{ system: SYS.LOINC, code, display }],
          },
        },
      });
    }

    if (anamnesis.rhesus) {
      const [code, display] =
        anamnesis.rhesus === Rhesus.POSITIVE
          ? ['LA6576-8', 'Positive']
          : ['LA6577-6', 'Negative'];
      out.push({
        localType: 'anamnesis_rhesus',
        resource: {
          ...base('laboratory', 'Laboratory'),
          code: {
            coding: [
              {
                system: SYS.LOINC,
                code: '10331-7',
                display: 'Rh [Type] in Blood',
              },
            ],
          },
          valueCodeableConcept: {
            coding: [{ system: SYS.LOINC, code, display }],
          },
        },
      });
    }

    if (anamnesis.statusKehamilan) {
      const [code, display] =
        anamnesis.statusKehamilan === PregnancyStatus.PREGNANT
          ? ['77386006', 'Pregnant']
          : ['60001007', 'Not pregnant'];
      out.push({
        localType: 'anamnesis_pregnancy',
        resource: {
          ...base('survey', 'Survey'),
          code: {
            coding: [
              {
                system: SYS.LOINC,
                code: '82810-3',
                display: 'Pregnancy status',
              },
            ],
          },
          valueCodeableConcept: {
            coding: [{ system: SYS.SNOMED, code, display }],
          },
        },
      });
    }

    return out;
  }

  // ── 04. Pemeriksaan Fisik ─────────────────────────────────────────────

  static toVitalSignObservation(vs: VitalSign, ctx: FhirContext) {
    const def = VITAL_SIGNS[vs.loincCode];
    const when = fhirDateTime(vs.recordedAt ?? vs.createdAt);
    return {
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
        coding: [
          {
            system: SYS.LOINC,
            code: vs.loincCode,
            display: def?.display ?? vs.name,
          },
        ],
      },
      subject: patientRef(ctx),
      performer: [practitionerRef(ctx)],
      encounter: encounterRef(ctx),
      effectiveDateTime: when,
      issued: when,
      valueQuantity: {
        value: Number(vs.value),
        unit: def?.unit ?? vs.unit,
        system: SYS.UCUM,
        code: def?.code ?? vs.unit,
      },
    };
  }

  /** OHIS — skor total DI-S, CI-S, OHI-S (Postman "04. OHIS") */
  static toOhisObservations(
    ohis: {
      id: number;
      diS: number;
      ciS: number;
      ohiS: number;
      interpretation?: string;
      createdAt: Date;
    },
    ctx: FhirContext,
  ) {
    const when = fhirDateTime(ohis.createdAt);
    const make = (
      code: string,
      display: string,
      value: number,
      text?: string,
    ) => ({
      resourceType: 'Observation',
      status: 'final',
      category: [
        {
          coding: [{ system: SYS.OBS_CATEGORY, code: 'exam', display: 'Exam' }],
        },
      ],
      code: { coding: [{ system: SYS.CLINICAL_TERM, code, display }] },
      subject: patientRef(ctx),
      performer: [practitionerRef(ctx)],
      encounter: encounterRef(ctx),
      effectiveDateTime: when,
      issued: when,
      valueQuantity: {
        value: Number(value),
        unit: '{score}',
        system: SYS.UCUM,
        code: '{score}',
      },
      ...(text ? { interpretation: [{ text }] } : {}),
    });
    return [
      {
        localType: 'ohis_di',
        resource: make('OC000056', 'Skor Total Debris Indeks', ohis.diS),
      },
      {
        localType: 'ohis_ci',
        resource: make('OC000057', 'Skor Total Kalkulus Indeks', ohis.ciS),
      },
      {
        localType: 'ohis_total',
        resource: make(
          'OC000058',
          'Skor Total Oral Hygiene Index Simplified (OHIS)',
          ohis.ohiS,
          ohis.interpretation,
        ),
      },
    ];
  }

  // ── 07. Diagnosis ─────────────────────────────────────────────────────

  static toCondition(diagnosis: Diagnosis, ctx: FhirContext) {
    const recorded = fhirDateTime(diagnosis.createdAt);
    const category = diagnosis.category ?? 'encounter-diagnosis';
    return {
      resourceType: 'Condition',
      clinicalStatus: {
        coding: [
          {
            system: SYS.COND_CLINICAL,
            code: diagnosis.clinicalStatus ?? 'active',
            display: capitalize(diagnosis.clinicalStatus ?? 'active'),
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: SYS.COND_CATEGORY,
              code: category,
              display:
                category === 'problem-list-item'
                  ? 'Problem List Item'
                  : 'Encounter Diagnosis',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: SYS.ICD10,
            code: diagnosis.icd10Code,
            display: diagnosis.icd10Display,
          },
        ],
      },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      onsetDateTime: fhirDateTime(diagnosis.onsetDate) ?? recorded,
      recordedDate: recorded,
      ...(diagnosis.note ? { note: [{ text: diagnosis.note }] } : {}),
    };
  }

  // ── 08. Tindakan ──────────────────────────────────────────────────────

  static toProcedure(
    procedure: Procedure,
    ctx: FhirContext,
    reason?: Diagnosis | null,
  ) {
    const start = fhirDateTime(procedure.performedStart ?? procedure.createdAt);
    const end = fhirDateTime(procedure.performedEnd) ?? start;
    const notes = [
      procedure.toothNumber ? `Gigi ${procedure.toothNumber}` : null,
      procedure.note,
    ].filter(Boolean);
    return {
      resourceType: 'Procedure',
      status: PROCEDURE_STATUS[procedure.status] ?? 'completed',
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
            code: procedure.icd9Code,
            display: procedure.procedureName,
          },
        ],
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
                    system: SYS.ICD10,
                    code: reason.icd10Code,
                    display: reason.icd10Display,
                  },
                ],
              },
            ],
          }
        : {}),
      ...(notes.length ? { note: [{ text: notes.join(' — ') }] } : {}),
    };
  }

  // ── 09. Tatalaksana: Peresepan & Pengeluaran Obat ─────────────────────

  /** Medication "for Request" / "for Dispense" — wajib kode KFA. */
  static toMedication(
    medication: Medication,
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
        coding: [
          {
            system: SYS.KFA,
            code: medication.kfaCode,
            display: medication.name,
          },
        ],
      },
      status: 'active',
      manufacturer: { reference: `Organization/${ctx.orgId}` },
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

  private static durationInDays(rx: Prescription): number | undefined {
    if (!rx.duration) return undefined;
    const factor =
      rx.durationUnit === 'weeks' ? 7 : rx.durationUnit === 'months' ? 30 : 1;
    return rx.duration * factor;
  }

  private static dosage(rx: Prescription) {
    return [
      {
        sequence: 1,
        text: rx.dosageInstruction,
        ...(rx.note ? { patientInstruction: rx.note } : {}),
      },
    ];
  }

  static toMedicationRequest(
    rx: Prescription,
    medication: Medication,
    medicationId: string,
    encounterLocalId: number,
    ctx: FhirContext,
  ) {
    const days = this.durationInDays(rx);
    return {
      resourceType: 'MedicationRequest',
      identifier: [
        {
          system: ids('prescription', ctx.orgId),
          use: 'official',
          value: String(encounterLocalId),
        },
        {
          system: ids('prescription-item', ctx.orgId),
          use: 'official',
          value: `${encounterLocalId}-${rx.id}`,
        },
      ],
      status:
        rx.status === 'cancelled'
          ? 'cancelled'
          : rx.status === 'dispensed'
            ? 'completed'
            : 'active',
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
        display: medication.name,
      },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      authoredOn: fhirDateTime(rx.createdAt),
      requester: practitionerRef(ctx),
      dosageInstruction: this.dosage(rx),
      dispenseRequest: {
        quantity: { value: rx.quantity },
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

  static toMedicationDispense(
    dispense: Dispense,
    rx: Prescription,
    medication: Medication,
    medicationId: string,
    medicationRequestId: string,
    encounterLocalId: number,
    ctx: FhirContext,
  ) {
    const when = fhirDateTime(dispense.dispensedAt ?? dispense.createdAt);
    const days = this.durationInDays(rx);
    return {
      resourceType: 'MedicationDispense',
      identifier: [
        {
          system: ids('prescription', ctx.orgId),
          use: 'official',
          value: String(encounterLocalId),
        },
        {
          system: ids('prescription-item', ctx.orgId),
          use: 'official',
          value: `${encounterLocalId}-${rx.id}-D${dispense.id}`,
        },
      ],
      status: 'completed',
      category: {
        coding: [
          {
            system: SYS.MEDDISP_CATEGORY,
            code: 'outpatient',
            display: 'Outpatient',
          },
        ],
      },
      medicationReference: {
        reference: `Medication/${medicationId}`,
        display: medication.name,
      },
      subject: patientRef(ctx),
      context: encounterRef(ctx),
      performer: [{ actor: practitionerRef(ctx) }],
      location: {
        reference: `Location/${ctx.location.id}`,
        display: ctx.location.name,
      },
      authorizingPrescription: [
        { reference: `MedicationRequest/${medicationRequestId}` },
      ],
      quantity: { value: dispense.quantityDispensed },
      ...(days
        ? {
            daysSupply: {
              value: days,
              unit: 'Day',
              system: SYS.UCUM,
              code: 'd',
            },
          }
        : {}),
      whenPrepared: when,
      whenHandedOver: when,
      dosageInstruction: this.dosage(rx),
    };
  }
}
