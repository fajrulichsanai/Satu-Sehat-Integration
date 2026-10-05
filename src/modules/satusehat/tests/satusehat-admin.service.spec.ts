import { NotFoundException } from '@nestjs/common';
import { SatusehatAdminService } from '../admin/satusehat-admin.service';

const ENV_KEYS = [
  'SATUSEHAT_ORGANIZATION_ID',
  'SATUSEHAT_CLIENT_ID',
  'SATUSEHAT_CLIENT_SECRET',
];

/** Repo palsu: createQueryBuilder(...).getRawMany() → rows */
function repo(
  rows: Record<string, unknown>[] = [],
  extra: Record<string, jest.Mock> = {},
) {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['select', 'addSelect', 'where', 'groupBy'])
    qb[m] = jest.fn(() => qb);
  qb.getRawMany = jest.fn().mockResolvedValue(rows);
  return {
    createQueryBuilder: jest.fn(() => qb),
    find: jest.fn().mockResolvedValue([]),
    ...extra,
  };
}

describe('SatusehatAdminService (pantauan super admin)', () => {
  const address = {
    line: 'Jl. A',
    provinceCode: '31',
    cityCode: '3171',
    districtCode: '317101',
    villageCode: '3171011001',
  };
  const clinics = [
    // Siap & lancar
    {
      id: 1,
      name: 'Klinik A',
      city: 'Jakarta',
      satusehatOrgId: 'ORG-A',
      satusehatClientId: 'c',
      satusehatClientSecret: 's',
      satusehatOrgName: 'Klinik A',
      satusehatProfile: { facilityType: 'klinik_pratama', ...address },
    },
    // Ada kunjungan gagal
    {
      id: 2,
      name: 'Klinik B',
      city: null,
      satusehatOrgId: 'ORG-B',
      satusehatClientId: 'c',
      satusehatClientSecret: 's',
      satusehatOrgName: 'Klinik B',
      satusehatProfile: { facilityType: 'tpmdg', ...address },
    },
    // Belum onboarding
    {
      id: 3,
      name: 'Klinik C',
      city: null,
      satusehatOrgId: null,
      satusehatClientId: null,
      satusehatClientSecret: null,
      satusehatProfile: null,
    },
  ];
  let service: SatusehatAdminService;
  const saved: Record<string, string | undefined> = {};

  beforeAll(() => ENV_KEYS.forEach((k) => (saved[k] = process.env[k])));
  afterAll(() =>
    ENV_KEYS.forEach((k) =>
      saved[k] === undefined
        ? delete process.env[k]
        : (process.env[k] = saved[k]),
    ),
  );

  beforeEach(() => {
    ENV_KEYS.forEach((k) => delete process.env[k]);
    service = new SatusehatAdminService(
      {
        find: jest.fn().mockResolvedValue(clinics),
        findOne: jest.fn(({ where }) =>
          Promise.resolve(clinics.find((c) => c.id === where.id) ?? null),
        ),
      } as any,
      repo([
        { clinicId: 1, total: '10', linked: '10', failed: '0' },
        { clinicId: 2, total: '5', linked: '3', failed: '2' },
      ]) as any,
      repo([{ clinicId: 1, total: '40', linked: '38' }]) as any,
      repo([
        { clinicId: 1, total: '2', linked: '2' },
        { clinicId: 2, total: '1', linked: '1' },
      ]) as any,
      repo([
        { clinicId: 1, total: '1', linked: '1' },
        { clinicId: 2, total: '1', linked: '1' },
      ]) as any,
      repo([{ clinicId: 1, total: '3', linked: '3' }]) as any,
      repo(
        [
          {
            clinicId: 2,
            success: '9',
            failed: '2',
            lastSyncAt: new Date('2026-10-05T10:00:00Z'),
          },
        ],
        { find: jest.fn().mockResolvedValue([]) },
      ) as any,
      { getSummary: jest.fn().mockResolvedValue({ resources: [] }) } as any,
    );
  });

  it('classifies each clinic and aggregates counts without exposing secrets (positive)', async () => {
    const res = await service.overview();
    expect(res.totals).toEqual({
      clinics: 3,
      ready: 1,
      attention: 1,
      notSetUp: 1,
    });
    const [a, b, c] = res.clinics;
    expect(a).toMatchObject({
      health: 'ok',
      patients: { total: 40, linked: 38 },
      encounters: { total: 10, linked: 10 },
    });
    expect(b).toMatchObject({
      health: 'warning',
      encounters: { failed: 2 },
      sync: { success: 9, failed: 2 },
    });
    expect(c).toMatchObject({ health: 'setup', credential: { source: null } });
    expect(JSON.stringify(res)).not.toMatch(/"s"|clientSecret/);
  });

  it('treats env credentials as configured for clinics without their own (edge)', async () => {
    process.env.SATUSEHAT_ORGANIZATION_ID = 'ENV-ORG';
    process.env.SATUSEHAT_CLIENT_ID = 'id';
    process.env.SATUSEHAT_CLIENT_SECRET = 'secret';
    const res = await service.overview();
    expect(res.clinics[2].credential).toMatchObject({
      source: 'env',
      organizationId: 'ENV-ORG',
    });
    expect(res.clinics[2].health).toBe('setup'); // profil & lokasi belum ada
    expect(JSON.stringify(res)).not.toContain('secret');
  });

  it('clinic detail rejects an unknown clinic (negative)', async () => {
    await expect(service.clinicDetail(99)).rejects.toThrow(NotFoundException);
    await expect(service.clinicDetail(1)).resolves.toMatchObject({
      clinic: { name: 'Klinik A' },
      credentialSource: 'clinic',
    });
  });
});
