/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-type-assertion */
import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../enums/user-role.enum';
import { FeatureAccessGuard } from '../../features/feature-access.guard';
import { FeaturesService } from '../../features/features.service';
import { KfaService } from '../kfa/kfa.service';
import { SatusehatClientService } from '../satusehat-client.service';
import { assertSatusehatEnabled } from '../satusehat-access';
import { SyncOrchestratorService } from '../sync/sync-orchestrator.service';
import { SyncQueueService } from '../sync/sync-queue.service';

/**
 * Integrasi SATUSEHAT adalah fitur opt-in per faskes: mati sampai super admin
 * menyalakannya. Selama mati tidak boleh ada akses data klinis maupun
 * panggilan jaringan ke SATUSEHAT atas nama faskes itu.
 */
describe('Integrasi SATUSEHAT per faskes (opt-in oleh super admin)', () => {
  let fetchMock: jest.Mock;
  /** Faskes yang dinyalakan admin; sisanya mati */
  let enabled: Set<number>;
  let features: {
    isClinicFeatureOn: jest.Mock;
    clinicIdsWithFeatureOn: jest.Mock;
  };

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    enabled = new Set<number>();
    features = {
      isClinicFeatureOn: jest.fn(async (id: number) => enabled.has(id)),
      clinicIdsWithFeatureOn: jest.fn(async () => new Set(enabled)),
    };
  });

  it('assertSatusehatEnabled menolak faskes yang belum diaktifkan (negative)', async () => {
    let thrown: unknown;
    try {
      await assertSatusehatEnabled(features as any, 1);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(ServiceUnavailableException);
    expect((thrown as ServiceUnavailableException).getResponse()).toMatchObject(
      { error: { code: 'SATUSEHAT_DISABLED' } },
    );
    enabled.add(1);
    await expect(assertSatusehatEnabled(features as any, 1)).resolves.toBe(
      undefined,
    );
  });

  describe('klien SATUSEHAT', () => {
    it('semua jalur keluar berhenti sebelum membaca klinik & jaringan (negative)', async () => {
      const repo = { findOne: jest.fn(), update: jest.fn() };
      const client = new SatusehatClientService(repo as any, features as any);
      const calls = [
        () => client.getAccessToken(1),
        () => client.testConnection(1),
        () => client.getFhir(1, 'Patient?x=1'),
        () => client.sendFhirResource(1, 'POST', 'Encounter', {}),
        () => client.postSsrme(1, 'chl', {}),
        () => client.postKyc(1, 'generate-url', 'x'),
      ];
      for (const call of calls) {
        await expect(call()).rejects.toThrow(ServiceUnavailableException);
      }
      expect(repo.findOne).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('faskes lain yang dinyalakan tidak membuka faskes ini (negative)', async () => {
      enabled.add(2);
      const repo = { findOne: jest.fn(), update: jest.fn() };
      const client = new SatusehatClientService(repo as any, features as any);
      await expect(client.getAccessToken(1)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(features.isClinicFeatureOn).toHaveBeenCalledWith(1, 'satusehat');
    });
  });

  describe('pengiriman kunjungan', () => {
    const build = () => {
      const repo = () => ({
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn(),
      });
      const clinicRepo = repo();
      const encounterRepo = repo();
      const others = Array.from({ length: 11 }, repo);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const service = new (SyncOrchestratorService as any)(
        encounterRepo,
        others[0],
        clinicRepo,
        ...others.slice(1),
        {},
        {},
        repo(),
        repo(),
        repo(),
        repo(),
        repo(),
        {},
        repo(),
        repo(),
        repo(),
        features,
      ) as SyncOrchestratorService;
      return { service, clinicRepo, encounterRepo };
    };

    it('auto-kirim latar belakang tidak menyentuh DB bila faskes belum aktif (negative)', async () => {
      const { service, clinicRepo, encounterRepo } = build();
      await service.syncEncounterInBackground(5, 1);
      expect(clinicRepo.findOne).not.toHaveBeenCalled();
      expect(encounterRepo.findOne).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('kirim manual gagal dengan pesan jelas (negative)', async () => {
      const { service, clinicRepo } = build();
      clinicRepo.findOne.mockResolvedValue({
        satusehatOrgId: 'o',
        satusehatClientId: 'c',
        satusehatClientSecret: 's',
      });
      const full = await service.syncEncounterFull(5, 1);
      expect(full.success).toBe(false);
      expect(full.steps[0].message).toMatch(/belum diaktifkan/i);
      const one = await service.syncResource('Patient', 1, 1);
      expect(one.success).toBe(false);
      expect(one.error).toMatch(/belum diaktifkan/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('faskes yang sudah dinyalakan lolos gerbang dan lanjut ke pemeriksaan kredensial (positive)', async () => {
      enabled.add(1);
      const { service, clinicRepo } = build();
      clinicRepo.findOne.mockResolvedValue({ id: 1, satusehatOrgId: null });
      const full = await service.syncEncounterFull(5, 1);
      expect(full.steps[0].message).toContain('Kredensial SATUSEHAT');
    });
  });

  describe('antrean ulang', () => {
    it('melewati faskes belum aktif tanpa menghabiskan jatah retry (negative)', async () => {
      enabled.add(2);
      const repo = {
        find: jest.fn().mockResolvedValue([
          {
            id: 1,
            clinicId: 1,
            retryCount: 0,
            resourceType: 'Patient',
            localId: 9,
          },
          {
            id: 2,
            clinicId: 2,
            retryCount: 0,
            resourceType: 'Patient',
            localId: 8,
          },
        ]),
        update: jest.fn(),
      };
      const orchestrator = {
        syncResource: jest.fn().mockResolvedValue({ success: true }),
      };
      const queue = new SyncQueueService(
        repo as any,
        orchestrator as any,
        features as any,
      );
      const res = await queue.processPending();
      expect(res.processed).toBe(1);
      expect(orchestrator.syncResource).toHaveBeenCalledTimes(1);
      expect(orchestrator.syncResource).toHaveBeenCalledWith('Patient', 8, 2);
      expect(repo.update).not.toHaveBeenCalledWith(1, expect.anything());
    });
  });

  describe('KFA', () => {
    const build = (localCount = 0) => {
      const catalog = {
        count: jest.fn().mockResolvedValue(localCount),
        findOne: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
        createQueryBuilder: jest.fn(),
      };
      const oauth = { getAccessToken: jest.fn() };
      const service = new KfaService(
        oauth as any,
        { get: jest.fn().mockReturnValue('true') } as any,
        catalog as any,
        features as any,
      );
      return { service, oauth, catalog };
    };

    it('live=false tanpa katalog lokal: pencarian kosong, tidak memanggil KFA (negative)', async () => {
      const { service, oauth } = build(0);
      const res = await service.search({ keyword: 'amoxi', live: false });
      expect(res).toEqual({ total: 0, page: 1, size: 20, items: [] });
      expect(oauth.getAccessToken).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('live=false: detail produk hanya dari salinan lokal (negative)', async () => {
      const { service, oauth } = build(0);
      await expect(service.getProduct('93015993', false)).rejects.toThrow(
        /katalog lokal/,
      );
      expect(oauth.getAccessToken).not.toHaveBeenCalled();
    });

    it('sinkron harian tidak jalan bila tidak ada faskes yang diaktifkan (negative)', async () => {
      const { service, oauth } = build(0);
      await service.scheduledCatalogSync();
      expect(oauth.getAccessToken).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('kontrol fitur (FeaturesService)', () => {
    const memRepo = (rows: any[] = []) => ({
      find: jest.fn(async ({ where }: any = {}) =>
        rows.filter((r) =>
          Object.entries(where ?? {}).every(([k, v]) => r[k] === v),
        ),
      ),
      findOne: jest.fn().mockResolvedValue(null),
      exists: jest.fn().mockResolvedValue(false),
    });
    const owner = { userId: 1, role: UserRole.OWNER, clinicId: 10 };
    const doctor = { userId: 2, role: UserRole.DOKTER, clinicId: 10 };
    const build = (clinicRows: any[] = []) =>
      new FeaturesService(
        memRepo() as any,
        memRepo(clinicRows) as any,
        memRepo() as any,
        memRepo() as any,
        memRepo() as any,
      );
    const on = [{ clinicId: 10, featureKey: 'satusehat', enabled: true }];

    it('opt-in: mati bawaan, fitur lain utuh, status integrasi false (negative)', async () => {
      const res = await build().effectiveFor(owner);
      expect(res.integrations).toEqual({ satusehat: false });
      expect(res.features).not.toContain('satusehat');
      for (const f of ['pasien', 'kunjungan', 'billing', 'farmasi']) {
        expect(res.features).toContain(f);
      }
    });

    it('menyala untuk faskes yang diaktifkan super admin (positive)', async () => {
      const res = await build(on).effectiveFor(owner);
      expect(res.integrations).toEqual({ satusehat: true });
      expect(res.features).toContain('satusehat');
    });

    it('faskes lain tidak ikut menyala (negative)', async () => {
      const service = build([
        { clinicId: 99, featureKey: 'satusehat', enabled: true },
      ]);
      expect((await service.effectiveFor(owner)).features).not.toContain(
        'satusehat',
      );
      expect(await service.isClinicFeatureOn(10, 'satusehat')).toBe(false);
      expect(await service.isClinicFeatureOn(99, 'satusehat')).toBe(true);
      expect([...(await service.clinicIdsWithFeatureOn('satusehat'))]).toEqual([
        99,
      ]);
    });

    it('fitur non-opt-in tetap menyala kecuali dimatikan (positive)', async () => {
      const service = build([
        { clinicId: 10, featureKey: 'tarif', enabled: false },
      ]);
      expect(await service.isClinicFeatureOn(10, 'pasien')).toBe(true);
      expect(await service.isClinicFeatureOn(10, 'tarif')).toBe(false);
    });

    it('guard: 403 FEATURE_DISABLED sampai diaktifkan admin (negative → positive)', async () => {
      const guardFor = (service: FeaturesService) =>
        new FeatureAccessGuard(
          { getAllAndOverride: () => 'satusehat' } as unknown as Reflector,
          service,
        );
      const ctx = (user: any): any => ({
        getHandler: () => undefined,
        getClass: () => undefined,
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      });
      await expect(guardFor(build()).canActivate(ctx(doctor))).rejects.toThrow(
        ForbiddenException,
      );
      await expect(guardFor(build(on)).canActivate(ctx(doctor))).resolves.toBe(
        true,
      );
    });
  });
});
