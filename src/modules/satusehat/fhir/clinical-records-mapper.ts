/**
 * Modul Kondisi & Observasi → FHIR Condition / Observation SATUSEHAT.
 *
 * Aturan FHIR R4 yang dijaga di sini (selain validasi di service):
 *  - con-3: Condition problem-list-item wajib punya clinicalStatus
 *  - con-4: abatement hanya untuk status inactive / remission / resolved
 *  - con-5: clinicalStatus tidak boleh ada bila entered-in-error
 *  - Observation: kode LOINC, kategori dan satuan UCUM dari katalog tetap
 */
import {
  ABATED_STATUSES,
  CLINICAL_STATUSES,
  CONDITION_SEVERITIES,
  ClinicalStatus,
  ConditionSeverity,
  ENTERED_IN_ERROR,
  OBSERVATION_BY_KEY,
  OBSERVATION_CATEGORIES,
  VERIFICATION_STATUSES,
  VerificationStatus,
} from '../../clinical-records/clinical-codes';
import { PatientCondition } from '../../clinical-records/entities/patient-condition.entity';
import { ClinicalObservation } from '../../clinical-records/entities/clinical-observation.entity';
import {
  FhirContext,
  LinkedResource,
  SYS,
  encounterRef,
  fhirDateTime,
  patientRef,
  practitionerRef,
} from './fhir-mapper';

const COND_VERIFICATION =
  'http://terminology.hl7.org/CodeSystem/condition-ver-status';

/** Tanggal lokal (WIB) → dateTime SATUSEHAT */
const fromLocalDate = (date?: string | null) =>
  date ? fhirDateTime(`${date}T00:00:00+07:00`) : undefined;

/** SATUSEHAT menolak waktu sebelum 3 Juni 2014 → dicatat di note saja */
const MIN_FHIR_DATE = '2014-06-03';
const dmy = (date: string) => date.split('-').reverse().join('-');

export const PROBLEM_CONDITION_TYPE = 'cond_problem';

/** localType link: kategori ikut disimpan supaya resume medis bisa mengelompokkan */
export const observationLinkType = (o: ClinicalObservation) =>
  `clin_obs_${OBSERVATION_BY_KEY.get(o.observationKey)?.category ?? 'exam'}`;

export class ClinicalRecordsMapper {
  static toProblemCondition(
    c: PatientCondition,
    ctx: FhirContext,
  ): LinkedResource {
    const removed = c.verificationStatus === ENTERED_IN_ERROR;
    const status = c.clinicalStatus as ClinicalStatus;
    const verification = removed
      ? { code: ENTERED_IN_ERROR, display: 'Entered in Error' }
      : {
          code: c.verificationStatus,
          display:
            VERIFICATION_STATUSES[c.verificationStatus as VerificationStatus]
              .display,
        };
    const severity = c.severity
      ? CONDITION_SEVERITIES[c.severity as ConditionSeverity]
      : null;
    const abated = !removed && ABATED_STATUSES.includes(status);
    const notes = [
      c.onsetDate && c.onsetDate < MIN_FHIR_DATE
        ? `Mulai sejak ${dmy(c.onsetDate)}`
        : null,
      c.note,
    ].filter((n): n is string => !!n);
    return {
      localType: PROBLEM_CONDITION_TYPE,
      localId: c.id,
      resource: {
        resourceType: 'Condition',
        ...(removed
          ? {}
          : {
              clinicalStatus: {
                coding: [
                  {
                    system: SYS.COND_CLINICAL,
                    code: status,
                    display: CLINICAL_STATUSES[status].display,
                  },
                ],
              },
            }),
        verificationStatus: {
          coding: [{ system: COND_VERIFICATION, ...verification }],
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
        ...(severity
          ? {
              severity: {
                coding: [
                  {
                    system: SYS.SNOMED,
                    code: severity.code,
                    display: severity.display,
                  },
                ],
              },
            }
          : {}),
        code: {
          coding: [
            {
              system: c.codeSystem === 'snomed' ? SYS.SNOMED : SYS.ICD10,
              code: c.code,
              display: c.display,
            },
          ],
          ...(c.nameId ? { text: c.nameId } : {}),
        },
        subject: patientRef(ctx),
        encounter: encounterRef(ctx),
        ...(c.onsetDate && c.onsetDate >= MIN_FHIR_DATE
          ? { onsetDateTime: fromLocalDate(c.onsetDate) }
          : {}),
        ...(abated && c.abatementDate
          ? { abatementDateTime: fromLocalDate(c.abatementDate) }
          : {}),
        recordedDate: fhirDateTime(c.createdAt),
        recorder: practitionerRef(ctx),
        ...(notes.length ? { note: notes.map((text) => ({ text })) } : {}),
      },
    };
  }

  static toObservation(
    o: ClinicalObservation,
    ctx: FhirContext,
  ): LinkedResource {
    const def = OBSERVATION_BY_KEY.get(o.observationKey);
    if (!def) {
      throw new Error(`Jenis observasi "${o.observationKey}" tidak dikenal`);
    }
    const when = fhirDateTime(o.effectiveAt);
    let value: Record<string, unknown>;
    if (def.kind === 'coded') {
      const answer = def.answers!.find((a) => a.code === o.valueCode);
      if (!answer) {
        throw new Error(`Jawaban ${def.label} tidak valid`);
      }
      value = {
        valueCodeableConcept: {
          coding: [
            { system: SYS.SNOMED, code: answer.code, display: answer.display },
          ],
          text: answer.label,
        },
      };
    } else {
      if (o.valueNumber === null || o.valueNumber === undefined) {
        throw new Error(`Nilai ${def.label} kosong`);
      }
      value = {
        valueQuantity: {
          value: Number(o.valueNumber),
          unit: def.ucum,
          system: SYS.UCUM,
          code: def.ucum,
        },
      };
    }
    return {
      localType: observationLinkType(o),
      localId: o.id,
      resource: {
        resourceType: 'Observation',
        status: o.status === ENTERED_IN_ERROR ? ENTERED_IN_ERROR : 'final',
        category: [
          {
            coding: [
              {
                system: SYS.OBS_CATEGORY,
                code: def.category,
                display: OBSERVATION_CATEGORIES[def.category],
              },
            ],
          },
        ],
        code: {
          coding: [
            { system: SYS.LOINC, code: def.loinc, display: def.display },
          ],
        },
        subject: patientRef(ctx),
        performer: [practitionerRef(ctx)],
        encounter: encounterRef(ctx),
        effectiveDateTime: when,
        issued: when,
        ...value,
        ...(o.note ? { note: [{ text: o.note }] } : {}),
      },
    };
  }
}
