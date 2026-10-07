import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../enums/user-role.enum';
import { FeaturesService } from '../features.service';
import { FeatureAccessGuard } from '../feature-access.guard';

type Row = Record<string, any>;

/** Repo memori sederhana: find/findOne/exists/save/delete dengan where datar */
function memRepo(rows: Row[] = []) {
  const match = (r: Row, where: Row = {}) =>
    Object.entries(where).every(([k, v]) => r[k] === v);
  let id = rows.length;
  return {
    rows,
    find: jest.fn(({ where }: { where?: Row } = {}) =>
      Promise.resolve(rows.filter((r) => match(r, where))),
    ),
    findOne: jest.fn(({ where }: { where: Row }) =>
      Promise.resolve(rows.find((r) => match(r, where)) ?? null),
    ),
    exists: jest.fn(({ where }: { where: Row }) =>
      Promise.resolve(rows.some((r) => match(r, where))),
    ),
    create: jest.fn((v: Row) => ({ ...v })),
    save: jest.fn((v: Row) => {
      if (!v.id) {
        v.id = ++id;
        rows.push(v);
      }
      return Promise.resolve(v);
    }),
    delete: jest.fn((where: Row) => {
      for (let i = rows.length - 1; i >= 0; i--)
        if (match(rows[i], where)) rows.splice(i, 1);
      return Promise.resolve({});
    }),
  };
}

describe('FeaturesService (kontrol fitur per klinik & user)', () => {
  const owner = { userId: 1, role: UserRole.OWNER, clinicId: 10 };
  const nurse = { userId: 3, role: UserRole.PERAWAT, clinicId: 10 };
  let custom: ReturnType<typeof memRepo>;
  let clinicF: ReturnType<typeof memRepo>;
  let userF: ReturnType<typeof memRepo>;
  let service: FeaturesService;

  beforeEach(() => {
    custom = memRepo([
      {
        id: 1,
        key: 'custom:laporan-bpjs',
        name: 'Laporan BPJS',
        description: null,
      },
    ]);
    clinicF = memRepo();
    userF = memRepo();
    const users = memRepo([
      { id: 1, clinicId: 10, role: UserRole.OWNER, name: 'Owner' },
      { id: 2, clinicId: 10, role: UserRole.DOKTER, name: 'drg. A' },
      { id: 3, clinicId: 10, role: UserRole.PERAWAT, name: 'Ns. B' },
      { id: 9, clinicId: 99, role: UserRole.DOKTER, name: 'Klinik lain' },
    ]);
    const clinics = memRepo([{ id: 10 }, { id: 99 }]);
    service = new FeaturesService(
      custom as any,
      clinicF as any,
      userF as any,
      users as any,
      clinics as any,
    );
  });

  it('nurse gets the same defaults as a doctor (positive)', async () => {
    const res = await service.effectiveFor(nurse);
    expect(res.features.sort()).toEqual(
      [
        'informed-consent',
        'kunjungan',
        'pasien',
        'reservasi',
        'share-fee-saya',
        'tampilan',
      ].sort(),
    );
    expect(res.custom).toEqual([]);
  });

  it('opt-in features (imunisasi) stay off until the clinic enables them (edge)', async () => {
    expect((await service.effectiveFor(nurse)).features).not.toContain(
      'imunisasi',
    );
    expect(await service.isExplicitlyDisabled(nurse, 'imunisasi')).toBe(true);
    const before = await service.clinicFeatures(10);
    expect(before.standard.find((f) => f.key === 'imunisasi')!.enabled).toBe(
      false,
    );
    await service.setClinicFeature(10, 'imunisasi', true, 0);
    expect((await service.effectiveFor(nurse)).features).toContain(
      'imunisasi',
    );
    expect(await service.isExplicitlyDisabled(nurse, 'imunisasi')).toBe(false);
  });

  it('clinic switch-off wins over role defaults and user overrides (positive)', async () => {
    await service.setClinicFeature(10, 'gudang', false, 0);
    expect((await service.effectiveFor(owner)).features).not.toContain(
      'gudang',
    );
    expect(await service.isExplicitlyDisabled(owner, 'gudang')).toBe(true);
    // owner tidak bisa menyalakan fitur yang dimatikan klinik
    await expect(
      service.setUserFeature(owner, 2, 'gudang', true),
    ).rejects.toThrow(BadRequestException);
    // kembali ke bawaan
    await service.setClinicFeature(10, 'gudang', null, 0);
    expect((await service.effectiveFor(owner)).features).toContain('gudang');
  });

  it('owner can hide a feature for one user and add one outside the role default (positive)', async () => {
    await service.setUserFeature(owner, 2, 'reservasi', false);
    await service.setUserFeature(owner, 2, 'laporan-kunjungan', true);
    const doctor = await service.effectiveFor({
      userId: 2,
      role: UserRole.DOKTER,
      clinicId: 10,
    });
    expect(doctor.features).not.toContain('reservasi');
    expect(doctor.features).toContain('laporan-kunjungan');
    // perawat lain tidak terpengaruh
    expect((await service.effectiveFor(nurse)).features).toContain('reservasi');
  });

  it('custom feature appears only where the clinic enables it and only for chosen users (edge)', async () => {
    expect((await service.effectiveFor(owner)).custom).toEqual([]); // klinik belum menyalakan
    await service.setClinicFeature(10, 'custom:laporan-bpjs', true, 0);
    expect((await service.effectiveFor(owner)).features).toContain(
      'custom:laporan-bpjs',
    );
    expect((await service.effectiveFor(nurse)).features).not.toContain(
      'custom:laporan-bpjs',
    );
    await service.setUserFeature(owner, 3, 'custom:laporan-bpjs', true);
    expect((await service.effectiveFor(nurse)).custom).toEqual([
      { key: 'custom:laporan-bpjs', name: 'Laporan BPJS' },
    ]);
    expect(
      await service.isExplicitlyDisabled(
        { userId: 2, role: UserRole.DOKTER, clinicId: 10 },
        'custom:laporan-bpjs',
      ),
    ).toBe(true);
  });

  it('owner cannot manage themselves, other clinics, or locked features (negative)', async () => {
    await expect(
      service.setUserFeature(owner, 1, 'gudang', false),
    ).rejects.toThrow(ForbiddenException);
    await expect(service.userFeatures(owner, 9)).rejects.toThrow(
      'User tidak ditemukan',
    );
    await expect(
      service.setUserFeature(owner, 2, 'user-management', false),
    ).rejects.toThrow('tidak bisa diatur');
    await expect(
      service.setClinicFeature(10, 'custom:tidak-ada', true, 0),
    ).rejects.toThrow('tidak dikenal');
  });

  it('guard blocks only explicitly disabled features (positive/negative)', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('gudang'),
    } as unknown as Reflector;
    const guard = new FeatureAccessGuard(reflector, service);
    const ctx = (user: unknown) =>
      ({
        getHandler: () => null,
        getClass: () => null,
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      }) as any;
    // dokter tidak punya "gudang" bawaan, tapi guard tidak memblokir bawaan role
    await expect(
      guard.canActivate(
        ctx({ userId: 2, role: UserRole.DOKTER, clinicId: 10 }),
      ),
    ).resolves.toBe(true);
    await service.setUserFeature(owner, 2, 'gudang', false);
    await expect(
      guard.canActivate(
        ctx({ userId: 2, role: UserRole.DOKTER, clinicId: 10 }),
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      guard.canActivate(ctx({ userId: 0, role: UserRole.SUPER_ADMIN })),
    ).resolves.toBe(true);
  });
});
