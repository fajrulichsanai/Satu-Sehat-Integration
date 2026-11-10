import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { ReferralsService } from '../referrals.service';

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8'));

describe('ReferralsService', () => {
  ReferralsService.pollDelayMs = 0;
  let saved: any;
  const repo = {
    create: jest.fn((x) => ({ id: 5, ...x })),
    save: jest.fn(async (x) => (saved = { ...x })),
    findOne: jest.fn(async () => saved),
    find: jest.fn(),
  };
  const encounter = {
    id: 41,
    clinicId: 1,
    patientId: 11,
    satusehatEncounterId: 'ENC-1',
    patient: { name: 'Budi', satusehatPatientId: 'P1' },
    practitioner: { name: 'drg. A', satusehatPractitionerId: 'N1' },
  };
  const encounterRepo = { findOne: jest.fn(async () => encounter) };
  const soapRepo = { findOne: jest.fn(async () => ({ id: 77 })) };
  const clinicRepo = {
    findOne: jest.fn(async () => ({
      id: 1,
      name: 'Klinik',
      satusehatOrgId: 'ORG',
    })),
  };
  const linkRepo = {
    find: jest.fn(async () => [
      { localType: 'soap_dx:icd10:K04.7', satusehatId: 'COND-1' },
      { localType: 'soap_chief_complaint', satusehatId: 'CC-1' },
    ]),
  };
  const terminology = {
    resolve: jest.fn(
      async (items: { code: string }[]) =>
        new Map(
          items.map((i) => [`icd10:${i.code}`, { display: `Name ${i.code}` }]),
        ),
    ),
  };
  const client = {
    sendFhirResource: jest.fn(),
    getFhir: jest.fn(),
    postBundle: jest.fn(),
  };
  const service = new ReferralsService(
    repo as any,
    encounterRepo as any,
    soapRepo as any,
    clinicRepo as any,
    linkRepo as any,
    terminology as any,
    client as any,
  );
  const dto = {
    careType: 'outpatient' as const,
    primaryDiagnosis: 'k04.7',
    serviceGroup: 'TK000584',
    specialty: 'LY086',
    performerType: '49993003',
    reason: ' Abses ',
    plannedDate: '2026-10-10',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    saved = undefined;
  });

  it('creates a referral and sends the pre-request Task once (positive)', async () => {
    client.sendFhirResource.mockResolvedValueOnce({
      status: 201,
      data: fixture('pre-request-response.json'),
    });
    const r = await service.create(41, 1, dto, 3);
    expect(r).toMatchObject({
      status: 'criteria',
      primaryDiagnosis: { code: 'K04.7', display: 'Name K04.7' },
      specialty: { code: 'LY086', display: 'Gigi dan Mulut - Bedah Mulut' },
      performerType: { code: '49993003', display: 'Oral surgeon' },
      reason: 'Abses',
      preTaskId: '8f8a31aa-a075-499f-a419-9e6d94da6696',
      lastError: null,
    });
    expect(r.questionnaires?.criteria?.title).toBe('Kriteria Rujukan');
    expect(client.sendFhirResource).toHaveBeenCalledTimes(1);
    expect(client.sendFhirResource.mock.calls[0][3].code.coding[0].code).toBe(
      'referral-pre-request',
    );
  });

  it('keeps a draft with a clear message when the visit is not in SATUSEHAT yet (negative)', async () => {
    encounterRepo.findOne.mockResolvedValueOnce({
      ...encounter,
      satusehatEncounterId: null,
    } as any);
    const r = await service.create(41, 1, dto, 3);
    expect(r.status).toBe('draft');
    expect(r.lastError).toMatch(/Belum terkirim ke SATUSEHAT: kunjungan/);
    expect(client.sendFhirResource).not.toHaveBeenCalled();
  });

  it('refuses unknown codes before sending anything (negative)', async () => {
    await expect(
      service.create(41, 1, { ...dto, specialty: 'LY999' }, 3),
    ).rejects.toThrow(/Poli tujuan/);
    await expect(
      service.create(41, 1, { ...dto, performerType: '123456' }, 3),
    ).rejects.toThrow(/tenaga kesehatan/);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('records a manual referral without SATUSEHAT (edge)', async () => {
    const r = await service.create(
      41,
      1,
      { ...dto, manual: true, targetName: ' RS Sehat ' },
      3,
    );
    expect(r).toMatchObject({ status: 'local', targetName: 'RS Sehat' });
    expect(client.sendFhirResource).not.toHaveBeenCalled();
  });

  it('searches candidates, polling when SATUSEHAT answers asynchronously (positive)', async () => {
    client.sendFhirResource.mockResolvedValueOnce({
      status: 201,
      data: fixture('pre-request-response.json'),
    });
    await service.create(41, 1, dto, 3);
    client.sendFhirResource.mockResolvedValueOnce({
      status: 201,
      data: { id: 'TASK-C', status: 'requested' },
    });
    client.getFhir.mockResolvedValueOnce({
      status: 200,
      data: {
        resourceType: 'Bundle',
        entry: [{ resource: fixture('candidate-response.json') }],
      },
    });
    const r = await service.searchCandidates(5, 1, {
      criteria: { '000001': true },
      areaAnswers: { '1.1': { code: '31' }, '1.2': { code: '3174' } },
    });
    expect(r.status).toBe('candidates');
    expect(r.candidateTaskId).toBe('TASK-C');
    expect(r.candidates).toEqual([
      expect.objectContaining({ orgId: '100025589', name: 'RSUP Fatmawati' }),
    ]);
    const task = client.sendFhirResource.mock.calls[1][3];
    expect(task.identifier[0].value).toMatch(/^REF-5-CAND-/);
    expect(client.getFhir).toHaveBeenCalledWith(1, 'Task?_id=TASK-C');
  });

  it('sends the referral Bundle once and stores the national number (positive / no double)', async () => {
    saved = {
      id: 5,
      clinicId: 1,
      encounterId: 41,
      careType: 'outpatient',
      status: 'candidates',
      primaryDiagnosis: { code: 'K04.7', display: 'x' },
      secondaryDiagnoses: [],
      serviceGroup: { code: 'TK000584', display: 'g' },
      specialty: { code: 'LY086', display: 's' },
      performerType: null,
      reason: 'r',
      plannedDate: '2026-10-10',
      candidateTaskId: 'TASK-C',
      candidates: [
        {
          orgId: '100025589',
          name: 'RSUP Fatmawati',
          distanceKm: 1,
          strata: null,
          bpjsCode: null,
        },
      ],
      serviceRequestId: null,
    };
    client.postBundle.mockResolvedValueOnce({
      status: 200,
      data: fixture('bundle-response.json'),
    });
    client.getFhir.mockResolvedValueOnce({
      status: 200,
      data: fixture('service-request.json'),
    });
    const r = await service.send(5, 1, { targetOrgId: '100025589' });
    expect(r).toMatchObject({
      status: 'sent',
      serviceRequestId: 'e220ebc6-b5ad-484d-96f2-58b2e846435a',
      carePlanId: 'a2beed6a-5828-4bab-a9f2-4853c3124244',
      referralNumber: '3000000200',
      targetName: 'RSUP Fatmawati',
    });
    await expect(
      service.send(5, 1, { targetOrgId: '100025589' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(client.postBundle).toHaveBeenCalledTimes(1);
    await expect(service.cancel(5, 1)).rejects.toThrow(/tidak bisa dibatalkan/);
  });

  it('only sends to a hospital recommended by SATUSEHAT and surfaces rejections (negative)', async () => {
    saved = {
      id: 5,
      clinicId: 1,
      encounterId: 41,
      careType: 'outpatient',
      status: 'candidates',
      primaryDiagnosis: { code: 'K04.7', display: 'x' },
      serviceGroup: { code: 'TK000584', display: 'g' },
      specialty: { code: 'LY086', display: 's' },
      reason: 'r',
      plannedDate: '2026-10-10',
      candidates: [{ orgId: 'A', name: 'RS A' }],
      serviceRequestId: null,
    };
    await expect(service.send(5, 1, { targetOrgId: 'B' })).rejects.toThrow(
      /rekomendasi/,
    );
    client.postBundle.mockResolvedValueOnce({
      status: 400,
      data: {
        resourceType: 'OperationOutcome',
        issue: [{ details: { text: 'performer invalid' } }],
      },
    });
    await expect(service.send(5, 1, { targetOrgId: 'A' })).rejects.toThrow(
      /performer invalid/,
    );
    expect(saved.status).toBe('candidates');
    expect(saved.lastError).toMatch(/performer invalid/);
  });
});
