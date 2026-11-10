import { readFileSync } from 'fs';
import { join } from 'path';
import {
  answersToItems,
  areaItems,
  buildCandidateTask,
  buildPreRequestTask,
  buildReferralBundle,
  bundleResourceIds,
  parseCandidates,
  parseQuestionnaires,
  referralNumberOf,
  ReferralContext,
} from '../referral-fhir';
import { Referral } from '../entities/referral.entity';

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'));

const ref = {
  id: 9,
  careType: 'outpatient',
  primaryDiagnosis: {
    code: 'K04.7',
    display: 'Periapical abscess without sinus',
  },
  secondaryDiagnoses: [
    { code: 'E11.9', display: 'Non-insulin-dependent diabetes mellitus' },
  ],
  serviceGroup: {
    code: 'TK000584',
    display: 'Kelompok Layanan Gigi dan Mulut',
  },
  specialty: { code: 'LY086', display: 'Gigi dan Mulut - Bedah Mulut' },
  performerType: { code: '49993003', display: 'Oral surgeon' },
  reason: 'Abses periapikal meluas, perlu bedah mulut',
  patientInstruction: 'Bawa hasil rontgen',
  plannedDate: '2026-10-10',
  pcareNumber: null,
  candidateTaskId: 'TASK-CAND',
} as unknown as Referral;

const ctx: ReferralContext = {
  orgId: '10000005',
  orgName: 'Klinik Gigi',
  patientId: 'P02478375538',
  patientName: 'Budi',
  practitionerId: '10009880728',
  practitionerName: 'drg. A',
  encounterId: 'ENC-1',
  diagnosisConditionIds: ['COND-1', 'COND-2'],
  supportingInfo: [
    { reference: 'Condition/CC-1', display: 'Anamnesis - Keluhan Utama' },
  ],
};
const now = new Date('2026-10-07T03:00:00.000Z');

describe('referral FHIR (Playbook Rujukan Pasien v6.1)', () => {
  it('builds the pre-request Task exactly like the Postman example (positive)', () => {
    expect(buildPreRequestTask(ref, ctx, now)).toEqual({
      resourceType: 'Task',
      identifier: [
        {
          system: 'http://sys-ids.kemkes.go.id/task/10000005',
          value: 'REF-9-PRE',
        },
      ],
      status: 'requested',
      intent: 'instance-order',
      priority: 'routine',
      code: {
        coding: [
          {
            system: 'http://terminology.kemkes.go.id',
            code: 'referral-pre-request',
            display: 'Referral pre request',
          },
        ],
      },
      authoredOn: '2026-10-07T03:00:00+00:00',
      lastModified: '2026-10-07T03:00:00+00:00',
      requester: { reference: 'Organization/10000005' },
      owner: { reference: 'Organization/10000005' },
      encounter: { reference: 'Encounter/ENC-1' },
      input: [
        {
          type: {
            coding: [
              {
                system: 'http://terminology.kemkes.go.id',
                code: 'primary-diagnosis',
                display: 'Primary Diagnosis',
              },
            ],
          },
          valueCoding: {
            system: 'http://hl7.org/fhir/sid/icd-10',
            code: 'K04.7',
            display: 'Periapical abscess without sinus',
          },
        },
      ],
    });
  });

  it('reads criteria & area questionnaires from the official response (positive)', () => {
    const q = parseQuestionnaires(fixture('pre-request-response.json'));
    expect(q.criteria?.title).toBe('Kriteria Rujukan');
    expect(q.area?.title).toBe('Jejaring Wilayah Rujukan');
  });

  it('turns answers into a nested QuestionnaireResponse and rejects bad types (positive/negative)', () => {
    const q = parseQuestionnaires(fixture('pre-request-response.json'));
    const items = answersToItems(q.criteria!.item, {
      '000001': true,
      '000003': false,
    });
    expect(items).toEqual([
      {
        linkId: '0',
        text: 'GAWAT DARURAT',
        item: [
          {
            linkId: '000001',
            text: expect.any(String),
            answer: [{ valueBoolean: true }],
          },
          {
            linkId: '000003',
            text: expect.any(String),
            answer: [{ valueBoolean: false }],
          },
        ],
      },
    ]);
    expect(() => answersToItems(q.criteria!.item, { '000001': 'ya' })).toThrow(
      /ya\/tidak/,
    );
    const area = answersToItems(q.area!.item, {
      '1.1': { code: '31' },
      '1.2': { code: '3174' },
    });
    expect(area[0].item[0].answer[0].valueCoding).toEqual({
      system: 'http://sys-ids.kemkes.go.id/administrative-area',
      code: '31',
      display: expect.any(String),
    });
    expect(() =>
      answersToItems(q.area!.item, { '1.1': { code: '99' } }),
    ).toThrow(/tidak valid/);
  });

  it('builds the candidate search Task with contained responses (positive)', () => {
    const task = buildCandidateTask(
      ref,
      ctx,
      [{ linkId: '3216', answer: [{ valueBoolean: false }] }],
      areaItems({
        provinceCode: '31',
        provinceName: 'DKI Jakarta',
        cityCode: '3174',
        cityName: 'Kota Jakarta Selatan',
      }),
      now,
    );
    expect(task.contained.map((c) => [c.id, c.questionnaire])).toEqual([
      ['criteria', 'https://fhir.kemkes.go.id/Questionnaire/Q100'],
      ['area', 'https://fhir.kemkes.go.id/Questionnaire/Q101'],
    ]);
    expect(task.for).toEqual({ reference: 'Patient/P02478375538' });
    expect(task.input.map((i) => i.type.coding[0].code)).toEqual([
      'referral-criteria',
      'area',
      '119270007',
      'TK000562',
      'primary-diagnosis',
      'secondary-diagnosis',
    ]);
    expect((task.input[2] as any).valueCoding).toEqual({
      system: 'http://snomed.info/sct',
      code: '737492002',
      display: 'Outpatient care management',
    });
  });

  it('parses recommended hospitals from the official response (positive)', () => {
    expect(parseCandidates(fixture('candidate-response.json'))).toEqual([
      {
        orgId: '100025589',
        name: 'RSUP Fatmawati',
        distanceKm: 85.49,
        strata: 'Utama',
        bpjsCode: '0902R001',
      },
    ]);
    expect(parseCandidates({})).toEqual([]);
  });

  it('builds the referral Bundle (ServiceRequest + CarePlan) per Tabel 6 (positive)', () => {
    const b = buildReferralBundle(
      ref,
      ctx,
      {
        orgId: '100025589',
        name: 'RSUP Fatmawati',
        distanceKm: 1,
        strata: null,
        bpjsCode: null,
      },
      now,
      { serviceRequest: 'sr-uuid', carePlan: 'cp-uuid' },
    );
    expect(b.meta.tag[0]).toEqual({
      system: 'http://terminology.kemkes.go.id',
      code: 'referral-request',
      display: 'Referral request',
    });
    const [sr, cp] = b.entry.map((e) => e.resource) as any[];
    expect(sr).toMatchObject({
      status: 'active',
      intent: 'original-order',
      basedOn: [{ reference: 'urn:uuid:cp-uuid' }],
      category: [
        {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '3457005',
              display: 'Patient referral',
            },
          ],
        },
      ],
      code: { coding: [{ code: '737492002' }] },
      requester: { reference: 'Organization/10000005' },
      performer: [
        { reference: 'Organization/100025589', display: 'RSUP Fatmawati' },
      ],
      performerType: {
        coding: [{ system: 'http://snomed.info/sct', code: '49993003' }],
      },
      reasonReference: [
        { reference: 'Condition/COND-1' },
        { reference: 'Condition/COND-2' },
      ],
      occurrenceDateTime: '2026-10-10T01:00:00+00:00',
    });
    expect(sr.supportingInfo[0]).toEqual({
      reference: 'Task/TASK-CAND',
      display: 'Task Respon Kandidat Faskes Rujukan',
    });
    expect(cp).toMatchObject({
      status: 'active',
      intent: 'plan',
      category: [
        { coding: [{ code: '736271009', display: 'Outpatient care plan' }] },
        { coding: [{ code: '3457005' }] },
      ],
      author: { reference: 'Practitioner/10009880728' },
      contributor: [{ reference: 'Organization/10000005' }],
      activity: [
        {
          detail: {
            kind: 'ServiceRequest',
            code: {
              coding: [
                {
                  system:
                    'http://terminology.kemkes.go.id/CodeSystem/clinical-speciality',
                  code: 'LY086',
                  display: 'Gigi dan Mulut - Bedah Mulut',
                },
              ],
            },
            status: 'not-started',
          },
        },
      ],
    });
  });

  it('reads created ids and the national referral number (edge)', () => {
    expect(bundleResourceIds(fixture('bundle-response.json'))).toEqual([
      'e220ebc6-b5ad-484d-96f2-58b2e846435a',
      'a2beed6a-5828-4bab-a9f2-4853c3124244',
    ]);
    expect(
      bundleResourceIds({
        entry: [{ response: { status: '400 Bad Request' } }],
      }),
    ).toEqual([null]);
    expect(referralNumberOf(fixture('service-request.json'))).toBe(
      '3000000200',
    );
    expect(referralNumberOf({})).toBeNull();
  });
});
