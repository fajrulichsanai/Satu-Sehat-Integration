import { ForbiddenException } from '@nestjs/common';
import { ClinicalAccessService } from '../clinical-access.service';
import { ClinicalAccessGuard } from '../clinical-access.guard';
import { UserRole } from '../../../enums/user-role.enum';

/**
 * Basis data mini: kunjungan {id, patient, doctorUserId, status}.
 * Dokter A = user 10, dokter B = user 20, pasien 01 = 1.
 */
function fakeDataSource(
  encounters: { id: number; patient: number; user: number; status: string }[],
) {
  return {
    query: jest.fn((sql: string, args: number[]) => {
      if (sql.includes('FROM encounters e\n         JOIN practitioners')) {
        const [patientId, userId] = args;
        return Promise.resolve(
          encounters.filter(
            (e) =>
              e.patient === patientId &&
              e.user === userId &&
              e.status !== 'cancelled',
          ),
        );
      }
      if (sql.includes('(pr.user_id = ?) AS own')) {
        const [userId, encounterId] = args;
        const e = encounters.find((x) => x.id === encounterId);
        return Promise.resolve(
          e ? [{ patient_id: e.patient, own: e.user === userId ? 1 : 0 }] : [],
        );
      }
      return Promise.resolve([]);
    }),
  };
}

const ctx = (
  user: any,
  path: string,
  params: any = {},
  method = 'GET',
  query: any = {},
) =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({ user, route: { path }, params, query, method }),
    }),
  }) as any;

describe('Akses pasien per dokter', () => {
  const A = { userId: 10, role: UserRole.DOKTER };
  const B = { userId: 20, role: UserRole.DOKTER };
  const admin = { userId: 1, role: UserRole.ADMIN };

  // Hari 1: pasien 01 ditangani dokter A (kunjungan 100)
  const day1 = [{ id: 100, patient: 1, user: 10, status: 'finished' }];
  // Hari 2: pasien 01 datang lagi, ditangani dokter B (kunjungan 200)
  const day2 = [...day1, { id: 200, patient: 1, user: 20, status: 'arrived' }];

  const guardWith = (rows: typeof day1) =>
    new ClinicalAccessGuard(
      new ClinicalAccessService(fakeDataSource(rows) as any),
    );

  it('hari 1: dokter B tidak bisa membuka pasien 01 milik dokter A', async () => {
    const g = guardWith(day1);
    await expect(
      g.canActivate(ctx(B, '/patients/:id/timeline', { id: '1' })),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      g.canActivate(
        ctx(B, '/encounters/:encounterId/soap-note', { encounterId: '100' }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('hari 1: dokter A membuka pasiennya', async () => {
    await expect(
      guardWith(day1).canActivate(
        ctx(A, '/patients/:id/timeline', { id: '1' }),
      ),
    ).resolves.toBe(true);
  });

  it('hari 2: dokter B melihat riwayat pasien 01 termasuk kunjungan dokter A kemarin', async () => {
    const g = guardWith(day2);
    await expect(
      g.canActivate(ctx(B, '/patients/:id/timeline', { id: '1' })),
    ).resolves.toBe(true);
    await expect(
      g.canActivate(
        ctx(B, '/encounters/:encounterId/soap-note', { encounterId: '100' }),
      ),
    ).resolves.toBe(true);
  });

  it('hari 2: dokter A tetap melihat riwayat termasuk kunjungan dokter B hari ini', async () => {
    await expect(
      guardWith(day2).canActivate(
        ctx(A, '/encounters/:encounterId/soap-note', { encounterId: '200' }),
      ),
    ).resolves.toBe(true);
  });

  it('dokter B tidak bisa mengubah kunjungan dokter A (hanya baca)', async () => {
    await expect(
      guardWith(day2).canActivate(
        ctx(
          B,
          '/encounters/:encounterId/soap-note',
          { encounterId: '100' },
          'PUT',
        ),
      ),
    ).rejects.toThrow('hanya dokter penanggung jawab');
  });

  it('kunjungan yang dibatalkan tidak membuka akses', async () => {
    const g = guardWith([
      { id: 300, patient: 2, user: 20, status: 'cancelled' },
    ]);
    await expect(
      g.canActivate(ctx(B, '/patients/:id', { id: '2' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('owner/admin tidak dibatasi', async () => {
    await expect(
      guardWith([]).canActivate(ctx(admin, '/patients/:id', { id: '1' })),
    ).resolves.toBe(true);
  });

  it('query ?patientId juga dicek, dan daftar persetujuan tanpa pasien ditolak', async () => {
    const g = guardWith(day1);
    await expect(
      g.canActivate(ctx(B, '/pharmacy/queue', {}, 'GET', { patientId: '1' })),
    ).rejects.toThrow(ForbiddenException);
    await expect(g.canActivate(ctx(A, '/patient-consents'))).rejects.toThrow(
      'Pilih pasien',
    );
  });
});
