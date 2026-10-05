import { BadRequestException } from '@nestjs/common';
import { SatusehatOnboardingService } from '../onboarding/satusehat-onboarding.service';
import { hashNik } from '../../../common/utils/nik-crypto.util';

const ENV_KEYS = [
  'SATUSEHAT_ORGANIZATION_ID',
  'SATUSEHAT_CLIENT_ID',
  'SATUSEHAT_CLIENT_SECRET',
  'SATUSEHAT_ENVIRONMENT',
];

describe('SatusehatOnboardingService (onboarding SATUSEHAT)', () => {
  const address = {
    line: 'Jl. Merdeka 1',
    provinceCode: '31',
    cityCode: '3171',
    districtCode: '317101',
    villageCode: '3171011001',
    rt: '1',
    rw: '2',
  };
  const baseClinic = {
    id: 1,
    name: 'Klinik Pratama Sehat',
    satusehatOrgId: 'ORG-1',
    satusehatClientId: 'cid',
    satusehatClientSecret: 'enc',
    satusehatEnvironment: 'sandbox',
    satusehatOrgName: null as string | null,
    satusehatProfile: {
      facilityType: 'klinik_pratama',
      phone: '0812',
      ...address,
    } as Record<string, unknown> | null,
  };
  let clinicRepo: { findOne: jest.Mock; update: jest.Mock; save: jest.Mock };
  let locationRepo: { find: jest.Mock; findOne: jest.Mock; update: jest.Mock };
  let orgs: Record<string, any>[];
  let orgRepo: Record<string, jest.Mock>;
  let client: { getFhir: jest.Mock; testConnection: jest.Mock };
  let orchestrator: {
    sendPrerequisite: jest.Mock;
    registerLocation: jest.Mock;
    practitionerIhsId: jest.Mock;
    patientIhsId: jest.Mock;
  };
  let service: SatusehatOnboardingService;
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(() => ENV_KEYS.forEach((k) => (savedEnv[k] = process.env[k])));
  afterAll(() =>
    ENV_KEYS.forEach((k) =>
      savedEnv[k] === undefined
        ? delete process.env[k]
        : (process.env[k] = savedEnv[k]),
    ),
  );

  beforeEach(() => {
    ENV_KEYS.forEach((k) => delete process.env[k]);
    clinicRepo = {
      findOne: jest.fn().mockResolvedValue({ ...baseClinic }),
      update: jest.fn(),
      save: jest.fn((c) => c),
    };
    locationRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      update: jest.fn(),
    };
    orgs = [];
    let nextId = 1;
    const matches = (o: any, where: any) =>
      Object.entries(where).every(([k, v]) => o[k] === v);
    orgRepo = {
      find: jest.fn(({ where }) =>
        Promise.resolve(orgs.filter((o) => matches(o, where))),
      ),
      findOne: jest.fn(({ where }) =>
        Promise.resolve(orgs.find((o) => matches(o, where)) ?? null),
      ),
      exists: jest.fn(({ where }) =>
        Promise.resolve(orgs.some((o) => matches(o, where))),
      ),
      create: jest.fn((v) => ({ ...v })),
      save: jest.fn((o) => {
        if (!o.id) {
          o.id = nextId++;
          orgs.push(o);
        }
        return Promise.resolve(o);
      }),
      update: jest.fn((id, patch) =>
        Promise.resolve(Object.assign(orgs.find((o) => o.id === id)!, patch)),
      ),
      delete: jest.fn(),
    };
    client = { getFhir: jest.fn(), testConnection: jest.fn() };
    let n = 0;
    orchestrator = {
      sendPrerequisite: jest
        .fn()
        .mockImplementation(() => Promise.resolve(`NEW-${++n}`)),
      registerLocation: jest.fn().mockResolvedValue('LOC-1'),
      practitionerIhsId: jest.fn(),
      patientIhsId: jest.fn(),
    };
    service = new SatusehatOnboardingService(
      clinicRepo as any,
      locationRepo as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]), count: jest.fn() } as any,
      orgRepo as any,
      client as any,
      orchestrator as any,
    );
  });

  it('applies the klinik pratama template and sends parent before child (positive)', async () => {
    await service.applyTemplate(1, 9);
    expect(orgs.map((o) => [o.code, o.parentId])).toEqual([
      ['YANKES', null],
      ['POLI-UMUM', 1],
      ['POLI-GIGI', 1],
      ['FARMASI', 1],
    ]);
    expect(orgs[0].address).toMatchObject({
      provinceCode: '31',
      villageCode: '3171011001',
    });

    await expect(service.sendOrganization(1, 2)).rejects.toThrow(
      'Kirim organisasi induknya',
    );
    await service.sendOrganization(1, 1);
    await service.sendOrganization(1, 2);
    const bodies = orchestrator.sendPrerequisite.mock.calls.map((c) => c[3]);
    expect(bodies.map((b) => [b.name, b.partOf.reference])).toEqual([
      ['Pelayanan Kesehatan', 'Organization/ORG-1'],
      ['Poli Umum', 'Organization/NEW-1'],
    ]);
    expect(bodies[0].identifier[0]).toMatchObject({
      system: 'http://sys-ids.kemkes.go.id/organization/ORG-1',
      value: 'YANKES',
    });
    const ext = bodies[0].address[0].extension[0];
    expect(ext.url).toBe(
      'https://fhir.kemkes.go.id/r4/StructureDefinition/administrativeCode',
    );
    expect(ext.extension.map((e: any) => e.url)).toEqual([
      'province',
      'city',
      'district',
      'village',
      'rt',
      'rw',
    ]);
  });

  it('re-sending an organization already registered uses its SATUSEHAT id (edge)', async () => {
    await service.applyTemplate(1, 9);
    orgs[0].satusehatId = 'S-1';
    await service.sendOrganization(1, 1);
    expect(orchestrator.sendPrerequisite.mock.calls[0][4]).toBe('S-1');
    // template is idempotent by code
    await service.applyTemplate(1, 9);
    expect(orgs).toHaveLength(4);
  });

  it('refuses to send an organization with an incomplete address (negative)', async () => {
    await service.saveOrganization(
      1,
      null,
      { code: 'X', name: 'Unit X', type: 'dept', address: { line: 'Jl. A' } },
      9,
    );
    await expect(service.sendOrganization(1, 1)).rejects.toThrow(
      'provinsi, kabupaten/kota, kecamatan, kelurahan/desa',
    );
    expect(orchestrator.sendPrerequisite).not.toHaveBeenCalled();
  });

  it('rejects duplicate codes and deleting registered organizations (negative)', async () => {
    await service.saveOrganization(
      1,
      null,
      { code: 'A', name: 'A', type: 'dept' },
      9,
    );
    await expect(
      service.saveOrganization(
        1,
        null,
        { code: 'A', name: 'B', type: 'dept' },
        9,
      ),
    ).rejects.toThrow('sudah dipakai');
    orgs[0].satusehatId = 'S';
    await expect(service.deleteOrganization(1, 1)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('verifyOrganization rejects an unknown Organization ID (negative)', async () => {
    client.getFhir.mockResolvedValue({
      status: 404,
      data: {
        resourceType: 'OperationOutcome',
        issue: [{ details: { text: 'not found' } }],
      },
    });
    await expect(service.verifyOrganization(1)).rejects.toThrow(
      BadRequestException,
    );
    client.getFhir.mockResolvedValue({
      status: 200,
      data: { resourceType: 'Organization', id: 'ORG-1', name: 'Klinik X' },
    });
    await expect(service.verifyOrganization(1)).resolves.toEqual({
      id: 'ORG-1',
      name: 'Klinik X',
      active: true,
    });
  });

  it('uses env credentials when the clinic has none; refuses when neither is set (edge/negative)', async () => {
    const empty = {
      ...baseClinic,
      satusehatOrgId: null,
      satusehatClientId: null,
      satusehatClientSecret: null,
    };
    clinicRepo.findOne.mockResolvedValue({ ...empty });
    await expect(service.matchPractitioners(1)).rejects.toThrow(
      'SATUSEHAT_ORGANIZATION_ID',
    );

    process.env.SATUSEHAT_ORGANIZATION_ID = 'ENV-ORG';
    process.env.SATUSEHAT_CLIENT_ID = 'env-cid';
    process.env.SATUSEHAT_CLIENT_SECRET = 'env-secret';
    clinicRepo.findOne.mockResolvedValue({ ...empty });
    const status = await service.status(1);
    expect(status.auth).toMatchObject({
      source: 'env',
      organizationId: 'ENV-ORG',
    });
    expect(JSON.stringify(status)).not.toContain('env-secret');
  });

  it('sends a location with the profile address as fallback and records errors (positive/negative)', async () => {
    const loc = { id: 5, clinicId: 1, name: 'Poli Gigi 1', ssAddress: null };
    locationRepo.findOne.mockResolvedValue(loc);
    await expect(service.sendLocation(1, 5)).resolves.toEqual({
      id: 5,
      satusehatId: 'LOC-1',
    });

    orchestrator.registerLocation.mockRejectedValueOnce(new Error('HTTP 400'));
    await expect(service.sendLocation(1, 5)).rejects.toThrow('HTTP 400');
    expect(locationRepo.update).toHaveBeenCalledWith(5, {
      ssSyncError: 'HTTP 400',
    });

    clinicRepo.findOne.mockResolvedValue({
      ...baseClinic,
      satusehatProfile: { facilityType: 'tpmdg' },
    });
    await expect(service.sendLocation(1, 5)).rejects.toThrow('Lengkapi alamat');
  });
  describe('perbaiki NIK langsung dari Onboarding', () => {
    let patients: Record<string, any>[];
    let patientRepo: Record<string, jest.Mock>;
    let svc: SatusehatOnboardingService;

    beforeEach(() => {
      process.env.PATIENT_DATA_ENCRYPTION_KEY =
        'test-key-0123456789abcdef0123456789';
      patients = [
        {
          id: 1,
          clinicId: 1,
          name: 'Ani',
          nik: null,
          nikHash: null,
          satusehatPatientId: null,
        },
        {
          id: 2,
          clinicId: 1,
          name: 'Budi',
          nik: '3171010101010002',
          nikHash: 'h2',
          satusehatPatientId: null,
        },
      ];
      const matches = (o: any, where: any) =>
        Object.entries(where).every(([k, v]) => o[k] === v);
      patientRepo = {
        findOne: jest.fn(({ where }) =>
          Promise.resolve(patients.find((p) => matches(p, where)) ?? null),
        ),
        save: jest.fn((p) => Promise.resolve(p)),
      };
      svc = new SatusehatOnboardingService(
        clinicRepo as any,
        locationRepo as any,
        { findOne: jest.fn() } as any,
        patientRepo as any,
        orgRepo as any,
        client as any,
        orchestrator as any,
      );
    });

    it('saves the NIK (hashed) and matches immediately (positive)', async () => {
      orchestrator.patientIhsId.mockResolvedValue('P0001');
      const res = await svc.fixPatient(1, 1, { nik: '3171010101010001' }, 9);
      expect(res).toEqual({
        id: 1,
        name: 'Ani',
        satusehatId: 'P0001',
        nikMasked: '***0001',
      });
      expect(patients[0].nikHash).toMatch(/^[0-9a-f]{64}$/);
      expect(orchestrator.patientIhsId).toHaveBeenCalledWith(
        1,
        patients[0],
        true,
      );
    });

    it('keeps the NIK when SATUSEHAT has no match, and reports why (edge)', async () => {
      orchestrator.patientIhsId.mockRejectedValue(
        new Error('NIK pasien Ani tidak ditemukan di SATUSEHAT'),
      );
      await expect(
        svc.fixPatient(1, 1, { nik: '3171010101010001' }, 9),
      ).rejects.toThrow('tidak ditemukan');
      expect(patientRepo.save).toHaveBeenCalled();
      expect(patients[0].nik).toBe('3171010101010001');
    });

    it('refuses a NIK already used by another patient, or retry without NIK (negative)', async () => {
      patients[1].nikHash = hashNik('3171010101010002');
      await expect(
        svc.fixPatient(1, 1, { nik: '3171010101010002' }, 9),
      ).rejects.toThrow('sudah dipakai pasien Budi');
      await expect(svc.fixPatient(1, 1, {}, 9)).rejects.toThrow('Isi NIK Ani');
      expect(orchestrator.patientIhsId).not.toHaveBeenCalled();
    });
  });
});
