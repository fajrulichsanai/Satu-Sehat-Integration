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
import {
  assertSatusehatEnabled,
  satusehatPlatformEnabled,
} from '../satusehat-platform';
import { SyncOrchestratorService } from '../sync/sync-orchestrator.service';
import { SyncQueueService } from '../sync/sync-queue.service';

/**
 * Saklar platform SATUSEHAT (SATUSEHAT_ENABLED): selama mati, tidak boleh ada
 * akses DB maupun panggilan jaringan ke SATUSEHAT, dan fitur disembunyikan.
 */
describe('Saklar platform SATUSEHAT', () => {
  const original = process.env.SATUSEHAT_ENABLED;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.SATUSEHAT_ENABLED = 'false';
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });
  afterAll(() => {
    if (original === undefined) delete process.env.SATUSEHAT_ENABLED;
    else process.env.SATUSEHAT_ENABLED = original;
  });

  describe('pembacaan env', () => {
    it.each([
      [undefined, false],
      ['', false],
      ['false', false],
      ['0', false],
      ['true', true],
      [' TRUE ', true],
    ])('SATUSEHAT_ENABLED=%j → %s', (value, expected) => {
      if (value === undefined) delete process.env.SATUSEHAT_ENABLED;
      else process.env.SATUSEHAT_ENABLED = value;
      expect(satusehatPlatformEnabled()).toBe(expected);
    });

    it('assertSatusehatEnabled menolak dengan kode SATUSEHAT_DISABLED (negative)', () => {
      let thrown: unknown;
      try {
        assertSatusehatEnabled();
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeInstanceOf(ServiceUnavailableException);
      expect(
        (thrown as ServiceUnavailableException).getResponse(),
      ).toMatchObject({ error: { code: 'SATUSEHAT_DISABLED' } });
    });
  });

  describe('klien SATUSEHAT', () => {
    it('semua jalur keluar berhenti sebelum DB dan jaringan (negative)', async () => {
      const repo = { findOne: jest.fn(), update: jest.fn() };
      const client = new SatusehatClientService(repo as any);

      await expect(client.getAccessToken(1)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(client.testConnection(1)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(client.getFhir(1, 'Patient?x=1')).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(
        client.sendFhirResource(1, 'POST', 'Encounter', {}),
      ).rejects.toThrow(ServiceUnavailableException);
      await expect(client.postSsrme(1, 'chl', {})).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(client.postKyc(1, 'generate-url', 'x')).rejects.toThrow(
        ServiceUnavailableException,
      );

      expect(repo.findOne).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
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
      ) as SyncOrchestratorService;
      return { service, clinicRepo, encounterRepo };
    };

    it('auto-kirim latar belakang tidak menyentuh DB (negative)', async () => {
      const { service, clinicRepo, encounterRepo } = build();
      await service.syncEncounterInBackground(5, 1);
      expect(clinicRepo.findOne).not.toHaveBeenCalled();
      expect(encounterRepo.findOne).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('kirim manual gagal dengan pesan jelas, tanpa DB (negative)', async () => {
      const { service, clinicRepo } = build();
      const clinic = {
        satusehatOrgId: 'o',
        satusehatClientId: 'c',
        satusehatClientSecret: 's',
      };
      clinicRepo.findOne.mockResolvedValue(clinic);
      const full = await service.syncEncounterFull(5, 1);
      expect(full.success).toBe(false);
      expect(full.steps[0].message).toMatch(/belum diaktifkan/i);
      const one = await service.syncResource('Patient', 1, 1);
      expect(one.success).toBe(false);
      expect(one.error).toMatch(/belum diaktifkan/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('antrean ulang tidak membaca log sama sekali (negative)', async () => {
      const repo = { find: jest.fn(), update: jest.fn() };
      const orchestrator = { syncResource: jest.fn() };
      const queue = new SyncQueueService(repo as any, orchestrator as any);
      await expect(queue.processPending()).resolves.toEqual({
        processed: 0,
        succeeded: 0,
        failed: 0,
      });
      expect(repo.find).not.toHaveBeenCalled();
      expect(orchestrator.syncResource).not.toHaveBeenCalled();
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
      );
      return { service, oauth };
    };

    it('tanpa katalog lokal: pencarian kosong, tidak memanggil KFA (negative)', async () => {
      const { service, oauth } = build(0);
      const res = await service.search({ keyword: 'amoxi' });
      expect(res).toEqual({ total: 0, page: 1, size: 20, items: [] });
      expect(oauth.getAccessToken).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sinkron harian terjadwal tidak berjalan (negative)', async () => {
      const { service, oauth } = build(0);
      await service.scheduledCatalogSync();
      expect(oauth.getAccessToken).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('kontrol fitur', () => {
    const memRepo = (rows: any[] = []) => ({
      find: jest.fn().mockResolvedValue(rows),
      findOne: jest.fn().mockResolvedValue(null),
      exists: jest.fn().mockResolvedValue(false),
    });
    const owner = { userId: 1, role: UserRole.OWNER, clinicId: 10 };
    const admin = { userId: 2, role: UserRole.ADMIN, clinicId: 10 };
    const build = () =>
      new FeaturesService(
        memRepo() as any,
        memRepo() as any,
        memRepo() as any,
        memRepo() as any,
        memRepo() as any,
      );

    it('fitur satusehat hilang untuk owner & admin, fitur lain utuh (negative)', async () => {
      const service = build();
      for (const actor of [owner, admin]) {
        const res = await service.effectiveFor(actor);
        expect(res.platform).toEqual({ satusehat: false });
        expect(res.features).not.toContain('satusehat');
        expect(res.features).toContain('pasien');
        expect(res.features).toContain('kunjungan');
        expect(res.features).toContain('billing');
      }
    });

    it('menyala kembali bila saklar true (positive)', async () => {
      process.env.SATUSEHAT_ENABLED = 'true';
      const res = await build().effectiveFor(owner);
      expect(res.platform).toEqual({ satusehat: true });
      expect(res.features).toContain('satusehat');
    });

    it('guard menolak endpoint fitur satusehat dengan 403 FEATURE_DISABLED (negative)', async () => {
      const service = build();
      const guard = new FeatureAccessGuard(
        { getAllAndOverride: () => 'satusehat' } as unknown as Reflector,
        service,
      );
      const ctx: any = {
        getHandler: () => undefined,
        getClass: () => undefined,
        switchToHttp: () => ({ getRequest: () => ({ user: owner }) }),
      };
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
      process.env.SATUSEHAT_ENABLED = 'true';
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });
  });
});
