/**
 * Pemeriksaan penunjang → FHIR (Playbook RME Rawat Jalan bab 10–11, Postman
 * "Pelayanan - Rawat Jalan" 08. Pemeriksaan Penunjang).
 *
 * Lab      : Procedure (status puasa) → ServiceRequest → Specimen →
 *            Observation per parameter → DiagnosticReport
 * Radiologi: ServiceRequest (+ACSN) → [ImagingStudy dari DICOM router] →
 *            Observation (bacaan) → DiagnosticReport
 */
import { toUcum } from './ucum';
import { LabOrder } from '../../diagnostics/entities/lab-order.entity';
import { LabResult } from '../../diagnostics/entities/lab-result.entity';
import { RadiologyOrder } from '../../diagnostics/entities/radiology-order.entity';
import {
  DIAGNOSTIC_PROCEDURE,
  FASTING,
  FASTING_STATUS_V2,
  IMAGING,
  INTERPRETATION_DISPLAY,
  LAB_PROCEDURE,
  LAB_REPORT_CATEGORY,
  SPECIMEN_SNOMED,
} from './clinical-codes';
import {
  FhirContext,
  SYS,
  encounterRef,
  fhirDateTime,
  ids,
  patientRef,
  practitionerRef,
} from './fhir-mapper';

const OBS_INTERPRETATION =
  'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation';
const REPORT_CATEGORY = 'http://terminology.hl7.org/CodeSystem/v2-0074';
const FASTING_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0916';
const DICOM = 'http://dicom.nema.org/resources/ontology/DCM';
const ACSN_TYPE = 'http://terminology.hl7.org/CodeSystem/v2-0203';

/** Kode SNOMED jenis spesimen; null bila tidak dikenal. */
export function specimenCoding(specimenType?: string | null) {
  const key = (specimenType ?? '').trim().toLowerCase();
  return SPECIMEN_SNOMED[key] ?? null;
}

/** Satuan teks katalog → kode UCUM; tanpa padanan dikirim sebagai teks saja */
const quantity = (value: number, unit?: string | null) => {
  const code = toUcum(unit);
  return {
    value,
    ...(unit ? { unit } : {}),
    ...(code ? { system: SYS.UCUM, code } : {}),
  };
};

const orgRef = (ctx: FhirContext) => ({
  reference: `Organization/${ctx.orgId}`,
});

export class DiagnosticsMapper {
  // ── Laboratorium ──────────────────────────────────────────────────────

  /** Status puasa sebelum pemeriksaan (Procedure, Postman "Status Puasa"). */
  static toFastingProcedure(
    order: LabOrder | { id: number; fasting: string | null; createdAt: Date },
    ctx: FhirContext,
  ) {
    if (!order.fasting) return null;
    const at = fhirDateTime(order.createdAt);
    const fasted = order.fasting === 'fasting';
    return {
      resourceType: 'Procedure',
      status: fasted ? 'completed' : 'not-done',
      category: {
        coding: [{ system: SYS.SNOMED, ...DIAGNOSTIC_PROCEDURE }],
        text: 'Prosedur diagnostik',
      },
      code: { coding: [{ system: SYS.SNOMED, ...FASTING }] },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      performedPeriod: { start: at, end: at },
      performer: [{ actor: practitionerRef(ctx) }],
      note: [
        {
          text:
            order.fasting === 'fasting'
              ? 'Pasien puasa'
              : order.fasting === 'not_fasting'
                ? 'Tidak puasa'
                : 'Tidak perlu puasa',
        },
      ],
    };
  }

  static toLabServiceRequest(
    order: LabOrder,
    ctx: FhirContext,
    opts: {
      reasonConditionId?: string | null;
      fastingProcedureId?: string | null;
    } = {},
  ) {
    const at = fhirDateTime(order.createdAt);
    return {
      resourceType: 'ServiceRequest',
      identifier: [
        { system: ids('servicerequest', ctx.orgId), value: `LAB-${order.id}` },
      ],
      status:
        order.status === 'cancelled'
          ? 'revoked'
          : order.status === 'completed'
            ? 'completed'
            : 'active',
      intent: 'original-order',
      priority: 'routine',
      category: [{ coding: [{ system: SYS.SNOMED, ...LAB_PROCEDURE }] }],
      code: {
        coding: [
          {
            system: order.codeSystem,
            code: order.code,
            display: order.display,
          },
        ],
        text: order.nameId,
      },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      occurrenceDateTime: at,
      authoredOn: at,
      requester: practitionerRef(ctx),
      performer: [practitionerRef(ctx)],
      ...(opts.reasonConditionId
        ? {
            reasonReference: [
              { reference: `Condition/${opts.reasonConditionId}` },
            ],
          }
        : {}),
      ...(opts.fastingProcedureId
        ? {
            supportingInfo: [
              { reference: `Procedure/${opts.fastingProcedureId}` },
            ],
          }
        : {}),
      ...(order.note ? { note: [{ text: order.note }] } : {}),
    };
  }

  /** Spesimen — null bila belum diambil atau jenisnya tidak dikenali. */
  static toSpecimen(
    order: LabOrder,
    serviceRequestId: string,
    ctx: FhirContext,
  ) {
    const type = specimenCoding(order.specimenType);
    if (!order.specimenCollectedAt || !type) return null;
    const collected = fhirDateTime(order.specimenCollectedAt);
    const fasting = order.fasting
      ? FASTING_STATUS_V2[order.fasting]
      : undefined;
    return {
      resourceType: 'Specimen',
      identifier: [
        {
          system: ids('specimen', ctx.orgId),
          value: `SPC-${order.id}`,
          assigner: orgRef(ctx),
        },
      ],
      status: 'available',
      type: {
        coding: [{ system: SYS.SNOMED, ...type }],
        text: order.specimenType,
      },
      collection: {
        collectedDateTime: collected,
        collector: practitionerRef(ctx),
        ...(fasting
          ? {
              fastingStatusCodeableConcept: {
                coding: [{ system: FASTING_SYSTEM, ...fasting }],
              },
            }
          : {}),
      },
      subject: patientRef(ctx),
      request: [{ reference: `ServiceRequest/${serviceRequestId}` }],
      receivedTime: collected,
    };
  }

  static toLabObservation(
    order: LabOrder,
    result: LabResult,
    refs: { serviceRequestId: string; specimenId?: string | null },
    ctx: FhirContext,
  ) {
    const at = fhirDateTime(order.resultedAt ?? result.createdAt);
    const value: Record<string, unknown> =
      result.valueNumber !== null && result.valueNumber !== undefined
        ? { valueQuantity: quantity(Number(result.valueNumber), result.unit) }
        : result.valueCode
          ? {
              valueCodeableConcept: {
                coding: [
                  {
                    system: result.valueCodeSystem ?? SYS.LOINC,
                    code: result.valueCode,
                    display: result.valueCodeDisplay ?? undefined,
                  },
                ],
              },
            }
          : { valueString: result.valueText ?? '' };
    const hasRange = result.refLow !== null || result.refHigh !== null;
    return {
      resourceType: 'Observation',
      identifier: [
        { system: ids('observation', ctx.orgId), value: `LABRES-${result.id}` },
      ],
      status: 'final',
      category: [
        {
          coding: [
            {
              system: SYS.OBS_CATEGORY,
              code: 'laboratory',
              display: 'Laboratory',
            },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: result.codeSystem,
            code: result.code,
            display: result.display,
          },
        ],
      },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      effectiveDateTime: at,
      issued: at,
      performer: [practitionerRef(ctx), orgRef(ctx)],
      ...(refs.specimenId
        ? { specimen: { reference: `Specimen/${refs.specimenId}` } }
        : {}),
      basedOn: [{ reference: `ServiceRequest/${refs.serviceRequestId}` }],
      ...value,
      ...(result.interpretation
        ? {
            interpretation: [
              {
                coding: [
                  {
                    system: OBS_INTERPRETATION,
                    code: result.interpretation,
                    display: INTERPRETATION_DISPLAY[result.interpretation],
                  },
                ],
              },
            ],
          }
        : {}),
      ...(hasRange
        ? {
            referenceRange: [
              {
                ...(result.refLow !== null
                  ? { low: quantity(Number(result.refLow), result.unit) }
                  : {}),
                ...(result.refHigh !== null
                  ? { high: quantity(Number(result.refHigh), result.unit) }
                  : {}),
              },
            ],
          }
        : {}),
    };
  }

  static toLabReport(
    order: LabOrder,
    refs: {
      serviceRequestId: string;
      specimenId?: string | null;
      observationIds: string[];
    },
    ctx: FhirContext,
  ) {
    const at = fhirDateTime(order.resultedAt ?? order.updatedAt);
    const category = LAB_REPORT_CATEGORY[
      (order.category ?? '').toLowerCase()
    ] ?? {
      code: 'LAB',
      display: 'Laboratory',
    };
    return {
      resourceType: 'DiagnosticReport',
      identifier: [
        {
          system: `${ids('diagnostic', ctx.orgId)}/lab`,
          use: 'official',
          value: `LAB-${order.id}`,
        },
      ],
      status: 'final',
      category: [{ coding: [{ system: REPORT_CATEGORY, ...category }] }],
      code: {
        coding: [
          {
            system: order.codeSystem,
            code: order.code,
            display: order.display,
          },
        ],
      },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      effectiveDateTime: at,
      issued: at,
      performer: [practitionerRef(ctx), orgRef(ctx)],
      result: refs.observationIds.map((id) => ({
        reference: `Observation/${id}`,
      })),
      ...(refs.specimenId
        ? { specimen: [{ reference: `Specimen/${refs.specimenId}` }] }
        : {}),
      basedOn: [{ reference: `ServiceRequest/${refs.serviceRequestId}` }],
      ...(order.conclusion ? { conclusion: order.conclusion } : {}),
    };
  }

  // ── Radiologi ─────────────────────────────────────────────────────────

  static acsnSystem(ctx: FhirContext) {
    return ids('acsn', ctx.orgId);
  }

  static toRadiologyServiceRequest(
    order: RadiologyOrder,
    ctx: FhirContext,
    opts: {
      reasonConditionId?: string | null;
      bodySite?: { code: string; display: string } | null;
    } = {},
  ) {
    const at = fhirDateTime(order.createdAt);
    return {
      resourceType: 'ServiceRequest',
      identifier: [
        { system: ids('servicerequest', ctx.orgId), value: `RAD-${order.id}` },
        {
          use: 'usual',
          type: { coding: [{ system: ACSN_TYPE, code: 'ACSN' }] },
          system: this.acsnSystem(ctx),
          value: order.accessionNumber,
        },
      ],
      status:
        order.status === 'cancelled'
          ? 'revoked'
          : order.status === 'completed'
            ? 'completed'
            : 'active',
      intent: 'original-order',
      priority: 'routine',
      category: [{ coding: [{ system: SYS.SNOMED, ...IMAGING }] }],
      code: {
        coding: [
          {
            system: order.codeSystem,
            code: order.code,
            display: order.display,
          },
        ],
        text: order.nameId,
      },
      orderDetail: [
        {
          coding: [{ system: DICOM, code: order.modality }],
          text: `Modality Code: ${order.modality}`,
        },
      ],
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      occurrenceDateTime: at,
      authoredOn: at,
      requester: practitionerRef(ctx),
      performer: [practitionerRef(ctx)],
      ...(opts.bodySite
        ? { bodySite: [{ coding: [{ system: SYS.SNOMED, ...opts.bodySite }] }] }
        : {}),
      ...(opts.reasonConditionId
        ? {
            reasonReference: [
              { reference: `Condition/${opts.reasonConditionId}` },
            ],
          }
        : {}),
      ...(order.note ? { note: [{ text: order.note }] } : {}),
    };
  }

  static toRadiologyObservation(
    order: RadiologyOrder,
    refs: { serviceRequestId: string; imagingStudyId?: string | null },
    ctx: FhirContext,
  ) {
    if (!order.resultText) return null;
    const at = fhirDateTime(order.resultedAt ?? order.updatedAt);
    return {
      resourceType: 'Observation',
      identifier: [
        { system: ids('observation', ctx.orgId), value: `RAD-${order.id}` },
      ],
      status: 'final',
      category: [
        {
          coding: [
            { system: SYS.OBS_CATEGORY, code: 'imaging', display: 'Imaging' },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: order.codeSystem,
            code: order.code,
            display: order.display,
          },
        ],
      },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      effectiveDateTime: at,
      issued: at,
      performer: [practitionerRef(ctx), orgRef(ctx)],
      basedOn: [{ reference: `ServiceRequest/${refs.serviceRequestId}` }],
      ...(refs.imagingStudyId
        ? {
            derivedFrom: [{ reference: `ImagingStudy/${refs.imagingStudyId}` }],
          }
        : {}),
      valueString: order.resultText,
    };
  }

  static toRadiologyReport(
    order: RadiologyOrder,
    refs: {
      serviceRequestId: string;
      observationId?: string | null;
      imagingStudyId?: string | null;
    },
    ctx: FhirContext,
  ) {
    if (!order.resultText && !order.conclusion) return null;
    const at = fhirDateTime(order.resultedAt ?? order.updatedAt);
    return {
      resourceType: 'DiagnosticReport',
      identifier: [
        {
          system: `${ids('diagnostic', ctx.orgId)}/rad`,
          use: 'official',
          value: `RAD-${order.id}`,
        },
      ],
      status: 'final',
      category: [
        {
          coding: [
            { system: REPORT_CATEGORY, code: 'RAD', display: 'Radiology' },
          ],
        },
      ],
      code: {
        coding: [
          {
            system: order.codeSystem,
            code: order.code,
            display: order.display,
          },
        ],
      },
      subject: patientRef(ctx),
      encounter: encounterRef(ctx),
      effectiveDateTime: at,
      issued: at,
      performer: [practitionerRef(ctx), orgRef(ctx)],
      ...(refs.imagingStudyId
        ? {
            imagingStudy: [
              { reference: `ImagingStudy/${refs.imagingStudyId}` },
            ],
          }
        : {}),
      ...(refs.observationId
        ? { result: [{ reference: `Observation/${refs.observationId}` }] }
        : {}),
      basedOn: [{ reference: `ServiceRequest/${refs.serviceRequestId}` }],
      ...(order.conclusion ? { conclusion: order.conclusion } : {}),
    };
  }
}
