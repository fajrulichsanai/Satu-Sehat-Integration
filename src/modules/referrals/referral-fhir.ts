import { fhirDateTime } from '../satusehat/fhir/fhir-mapper';
import {
  ADMIN_AREA,
  AREA_QUESTIONNAIRE,
  CARE_TYPES,
  CLINICAL_SPECIALITY,
  CRITERIA_QUESTIONNAIRE,
  FACILITY_TYPE,
  ICD10,
  KEMKES,
  PCARE_NUMBER_SYSTEM,
  REFERRAL_NUMBER_SYSTEMS,
  SNOMED,
} from './referral-codes';
import {
  Referral,
  ReferralCandidate,
  ReferralCoding,
} from './entities/referral.entity';

/** ID SATUSEHAT yang dibutuhkan untuk alur rujukan */
export interface ReferralContext {
  orgId: string;
  orgName: string;
  patientId: string;
  patientName: string;
  practitionerId: string;
  practitionerName: string;
  encounterId: string;
  /** Condition diagnosis (dari kunjungan yang sudah terkirim) */
  diagnosisConditionIds: string[];
  /** Data pendukung yang sudah terkirim (mis. keluhan utama, tanda vital) */
  supportingInfo: { reference: string; display: string }[];
}

export type AnswerValue =
  | boolean
  | string
  | { code: string; display?: string; system?: string };

const diagnosisInput = (kind: 'primary' | 'secondary', dx: ReferralCoding) => ({
  type: {
    coding: [
      {
        system: KEMKES,
        code: `${kind}-diagnosis`,
        display:
          kind === 'primary' ? 'Primary Diagnosis' : 'Secondary diagnosis',
      },
    ],
  },
  valueCoding: { system: ICD10, code: dx.code, display: dx.display },
});

const taskIdentifier = (orgId: string, value: string) => [
  { system: `http://sys-ids.kemkes.go.id/task/${orgId}`, value },
];

/** 1.1.1 Pra Permintaan Kandidat Fasyankes Rujukan */
export function buildPreRequestTask(
  ref: Referral,
  ctx: ReferralContext,
  now: Date,
) {
  const t = fhirDateTime(now);
  return {
    resourceType: 'Task',
    identifier: taskIdentifier(ctx.orgId, `REF-${ref.id}-PRE`),
    status: 'requested',
    intent: 'instance-order',
    priority: 'routine',
    code: {
      coding: [
        {
          system: KEMKES,
          code: 'referral-pre-request',
          display: 'Referral pre request',
        },
      ],
    },
    authoredOn: t,
    lastModified: t,
    requester: { reference: `Organization/${ctx.orgId}` },
    owner: { reference: `Organization/${ctx.orgId}` },
    encounter: { reference: `Encounter/${ctx.encounterId}` },
    input: [diagnosisInput('primary', ref.primaryDiagnosis)],
  };
}

type QItem = {
  linkId: string;
  text?: string;
  type?: string;
  item?: QItem[];
  answerOption?: {
    valueCoding?: { code: string; display?: string; system?: string };
  }[];
};

/**
 * Jawaban kuesioner → item QuestionnaireResponse dengan struktur yang sama
 * (grup bersarang). Item tanpa jawaban dilewati; tipe jawaban diperiksa.
 */
export function answersToItems(
  items: QItem[],
  answers: Record<string, AnswerValue | undefined>,
): Record<string, any>[] {
  const out: Record<string, any>[] = [];
  for (const it of items ?? []) {
    if (it.type === 'group' || (it.item?.length && !it.type)) {
      const children = answersToItems(it.item ?? [], answers);
      if (children.length)
        out.push({
          linkId: it.linkId,
          ...(it.text ? { text: it.text } : {}),
          item: children,
        });
      continue;
    }
    const v = answers[it.linkId];
    if (v === undefined || v === null || v === '') continue;
    let answer: Record<string, any>;
    if (it.type === 'boolean') {
      if (typeof v !== 'boolean')
        throw new Error(`Jawaban "${it.text ?? it.linkId}" harus ya/tidak`);
      answer = { valueBoolean: v };
    } else if (it.type === 'choice' || it.type === 'open-choice') {
      const code = typeof v === 'object' ? v.code : String(v);
      const opt = it.answerOption?.find(
        (o) => o.valueCoding?.code === code,
      )?.valueCoding;
      if (!opt)
        throw new Error(`Pilihan "${it.text ?? it.linkId}" tidak valid`);
      answer = {
        valueCoding: {
          system: opt.system,
          code: opt.code,
          display: opt.display,
        },
      };
    } else {
      if (typeof v !== 'string')
        throw new Error(`Jawaban "${it.text ?? it.linkId}" harus teks`);
      answer = { valueString: v.trim() };
    }
    out.push({
      linkId: it.linkId,
      ...(it.text ? { text: it.text } : {}),
      answer: [answer],
    });
  }
  return out;
}

/** Kuesioner jejaring wilayah dibuat dari pilihan provinsi & kab/kota */
export function areaItems(area: NonNullable<Referral['area']>) {
  return [
    {
      linkId: '1',
      text: 'Jejaring wilayah rujukan',
      item: [
        {
          linkId: '1.1',
          text: 'Provinsi',
          answer: [
            {
              valueCoding: {
                system: ADMIN_AREA,
                code: area.provinceCode,
                display: area.provinceName,
              },
            },
          ],
        },
        {
          linkId: '1.2',
          text: 'Kabupaten/Kota',
          answer: [
            {
              valueCoding: {
                system: ADMIN_AREA,
                code: area.cityCode,
                display: area.cityName,
              },
            },
          ],
        },
      ],
    },
  ];
}

/** 1.2.1 Pencarian Kandidat Fasyankes Rujukan */
export function buildCandidateTask(
  ref: Referral,
  ctx: ReferralContext,
  criteriaItems: Record<string, any>[],
  areaQrItems: Record<string, any>[],
  now: Date,
) {
  const t = fhirDateTime(now);
  const qr = (
    id: string,
    questionnaire: string,
    item: Record<string, any>[],
  ) => ({
    resourceType: 'QuestionnaireResponse',
    id,
    questionnaire,
    status: 'completed',
    subject: { reference: `Patient/${ctx.patientId}` },
    encounter: { reference: `Encounter/${ctx.encounterId}` },
    item,
  });
  const care = CARE_TYPES[ref.careType];
  const contained = [
    ...(criteriaItems.length
      ? [qr('criteria', CRITERIA_QUESTIONNAIRE, criteriaItems)]
      : []),
    qr('area', AREA_QUESTIONNAIRE, areaQrItems),
  ];
  return {
    resourceType: 'Task',
    contained,
    identifier: taskIdentifier(ctx.orgId, `REF-${ref.id}-CAND`),
    status: 'requested',
    intent: 'instance-order',
    priority: 'routine',
    code: {
      coding: [
        {
          system: KEMKES,
          code: 'request-referral-candidate',
          display: 'Request for referral candidate',
        },
      ],
    },
    for: { reference: `Patient/${ctx.patientId}` },
    authoredOn: t,
    lastModified: t,
    requester: { reference: `Organization/${ctx.orgId}` },
    owner: { reference: `Organization/${ctx.orgId}` },
    encounter: { reference: `Encounter/${ctx.encounterId}` },
    input: [
      ...(criteriaItems.length
        ? [
            {
              type: {
                coding: [
                  {
                    system: KEMKES,
                    code: 'referral-criteria',
                    display: 'Referral Criteria',
                  },
                ],
              },
              valueReference: {
                reference: '#criteria',
                display: 'Referral Criteria Response',
              },
            },
          ]
        : []),
      {
        type: { coding: [{ system: KEMKES, code: 'area', display: 'Area' }] },
        valueReference: {
          reference: '#area',
          display: 'Jejaring Wilayah Rujukan',
        },
      },
      {
        type: {
          coding: [
            {
              system: SNOMED,
              code: '119270007',
              display: 'Management procedure',
            },
          ],
        },
        valueCoding: { ...care.code },
      },
      {
        type: {
          coding: [
            { system: KEMKES, code: 'TK000562', display: 'Kelompok Layanan' },
          ],
        },
        valueCoding: {
          system: KEMKES,
          code: ref.serviceGroup.code,
          display: ref.serviceGroup.display,
        },
      },
      diagnosisInput('primary', ref.primaryDiagnosis),
      ...(ref.secondaryDiagnoses ?? []).map((d) =>
        diagnosisInput('secondary', d),
      ),
    ],
  };
}

/** Kandidat dari Task rekomendasi (output candidate + extension providerAtribute) */
export function parseCandidates(
  task: Record<string, any>,
): ReferralCandidate[] {
  const out: ReferralCandidate[] = [];
  for (const o of task?.output ?? []) {
    const ref: string | undefined = o?.valueReference?.reference;
    if (!ref?.startsWith('Organization/')) continue;
    const attrs: any[] = (o.extension ?? []).flatMap(
      (e: any) => e?.extension ?? [],
    );
    const attr = (url: string) => attrs.find((a) => a?.url === url);
    const dist = attr('distance')?.valueQuantity;
    out.push({
      orgId: ref.slice('Organization/'.length),
      name: o.valueReference.display ?? ref,
      distanceKm:
        typeof dist?.value === 'number'
          ? dist.code === 'm'
            ? Math.round(dist.value) / 1000
            : dist.value
          : null,
      strata: attr('strata')?.valueCode ?? null,
      bpjsCode: attr('bpjs-code')?.valueCode ?? null,
    });
  }
  return out;
}

/** Ambil kuesioner kriteria & wilayah dari Task respon kriteria rujukan */
export function parseQuestionnaires(task: Record<string, any>) {
  const contained: any[] = task?.contained ?? [];
  const byRef = (ref?: string) =>
    ref?.startsWith('#')
      ? contained.find((c) => c?.id === ref.slice(1))
      : undefined;
  let criteria: any = null;
  let area: any = null;
  for (const o of task?.output ?? []) {
    const code: string | undefined = o?.type?.coding?.[0]?.code;
    const q = byRef(o?.valueReference?.reference);
    if (!q || q.resourceType !== 'Questionnaire') continue;
    if (code === 'referral-criteria') criteria = q;
    else if (code === 'area' || code === 'referral-network-area') area = q;
  }
  return { criteria, area };
}

export function referralNumberOf(sr: Record<string, any>): string | null {
  for (const system of REFERRAL_NUMBER_SYSTEMS) {
    const v = (sr?.identifier ?? []).find(
      (i: any) => i?.system === system,
    )?.value;
    if (v) return String(v);
  }
  return null;
}

/** 1.3.1 Pengiriman Permintaan Rujukan — Bundle ServiceRequest + CarePlan */
export function buildReferralBundle(
  ref: Referral,
  ctx: ReferralContext,
  target: ReferralCandidate,
  now: Date,
  ids: { serviceRequest: string; carePlan: string },
) {
  const care = CARE_TYPES[ref.careType];
  const conditions = ctx.diagnosisConditionIds.map((id) => ({
    reference: `Condition/${id}`,
  }));
  const serviceRequest = {
    resourceType: 'ServiceRequest',
    identifier: [
      {
        system: `http://sys-ids.kemkes.go.id/servicerequest/${ctx.orgId}`,
        value: `REF-${ref.id}`,
      },
      ...(ref.pcareNumber
        ? [{ system: PCARE_NUMBER_SYSTEM, value: ref.pcareNumber }]
        : []),
    ],
    basedOn: [{ reference: `urn:uuid:${ids.carePlan}` }],
    status: 'active',
    intent: 'original-order',
    priority: 'routine',
    category: [
      {
        coding: [
          { system: SNOMED, code: '3457005', display: 'Patient referral' },
        ],
      },
    ],
    code: { coding: [{ ...care.code }], text: ref.reason },
    subject: {
      reference: `Patient/${ctx.patientId}`,
      display: ctx.patientName,
    },
    encounter: { reference: `Encounter/${ctx.encounterId}` },
    occurrenceDateTime: fhirDateTime(`${ref.plannedDate}T01:00:00Z`),
    authoredOn: fhirDateTime(now),
    requester: { reference: `Organization/${ctx.orgId}`, display: ctx.orgName },
    ...(ref.performerType
      ? {
          performerType: {
            coding: [
              {
                system: SNOMED,
                code: ref.performerType.code,
                display: ref.performerType.display,
              },
            ],
          },
        }
      : {}),
    performer: [
      { reference: `Organization/${target.orgId}`, display: target.name },
    ],
    reasonReference: conditions,
    locationCode: [{ coding: [{ ...FACILITY_TYPE }] }],
    supportingInfo: [
      ...(ref.candidateTaskId
        ? [
            {
              reference: `Task/${ref.candidateTaskId}`,
              display: 'Task Respon Kandidat Faskes Rujukan',
            },
          ]
        : []),
      ...ctx.supportingInfo,
    ],
    ...(ref.patientInstruction
      ? { patientInstruction: ref.patientInstruction }
      : {}),
  };
  const carePlan = {
    resourceType: 'CarePlan',
    identifier: [
      {
        system: `http://sys-ids.kemkes.go.id/careplan/${ctx.orgId}`,
        value: `REF-${ref.id}`,
      },
      {
        system: 'http://sys-ids.kemkes.go.id/careplan/authoring-organization',
        value: ctx.orgId,
      },
    ],
    status: 'active',
    intent: 'plan',
    category: [
      { coding: [{ ...care.planCategory }] },
      {
        coding: [
          { system: SNOMED, code: '3457005', display: 'Patient referral' },
        ],
      },
    ],
    title: 'Rencana Rujukan Pasien',
    description: ref.reason,
    subject: {
      reference: `Patient/${ctx.patientId}`,
      display: ctx.patientName,
    },
    encounter: { reference: `Encounter/${ctx.encounterId}` },
    created: fhirDateTime(now),
    author: {
      reference: `Practitioner/${ctx.practitionerId}`,
      display: ctx.practitionerName,
    },
    addresses: conditions,
    ...(ctx.supportingInfo.length
      ? { supportingInfo: ctx.supportingInfo }
      : {}),
    contributor: [{ reference: `Organization/${ctx.orgId}` }],
    activity: [
      {
        detail: {
          kind: 'ServiceRequest',
          code: {
            coding: [
              {
                system: CLINICAL_SPECIALITY,
                code: ref.specialty.code,
                display: ref.specialty.display,
              },
            ],
            text: `Permintaan Layanan ${ref.specialty.display}`,
          },
          status: 'not-started',
        },
      },
    ],
  };
  return {
    resourceType: 'Bundle',
    type: 'transaction',
    meta: {
      tag: [
        {
          system: KEMKES,
          code: 'referral-request',
          display: 'Referral request',
        },
      ],
    },
    entry: [
      {
        fullUrl: `urn:uuid:${ids.serviceRequest}`,
        resource: serviceRequest,
        request: { method: 'POST', url: 'ServiceRequest' },
      },
      {
        fullUrl: `urn:uuid:${ids.carePlan}`,
        resource: carePlan,
        request: { method: 'POST', url: 'CarePlan' },
      },
    ],
  };
}

/** ID resource hasil transaction-response, sesuai urutan entry */
export function bundleResourceIds(
  resp: Record<string, any>,
): (string | null)[] {
  return (resp?.entry ?? []).map((e: any) => {
    const r = e?.response ?? {};
    if (!String(r.status ?? '').startsWith('2')) return null;
    if (r.resourceID) return String(r.resourceID);
    const m =
      /\/([A-Za-z]+)\/([^/]+)\/_history/.exec(r.location ?? '') ??
      /\/([A-Za-z]+)\/([^/]+)$/.exec(r.location ?? '');
    return m ? m[2] : null;
  });
}
