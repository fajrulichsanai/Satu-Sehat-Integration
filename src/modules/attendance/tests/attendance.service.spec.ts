import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { UserRole } from '../../../enums';
import { AttendanceService } from '../attendance.service';
import { AttendanceConfigService } from '../attendance-config.service';
import { wibDate } from '../attendance-rules';

type Row = Record<string, any>;

/** Repo memori: find/findOne/count/save/update/delete, paham In/Between/IsNull */
function memRepo(rows: Row[] = []) {
  const matchValue = (actual: unknown, expected: unknown): boolean => {
    if (expected instanceof FindOperator) {
      const v = expected.value as any;
      switch (expected.type) {
        case 'in':
          return (v as unknown[]).includes(actual);
        case 'between':
          return (actual as any) >= v[0] && (actual as any) <= v[1];
        case 'isNull':
          return actual === null || actual === undefined;
        default:
          throw new Error(`operator ${expected.type} tidak didukung`);
      }
    }
    return actual === expected;
  };
  const match = (r: Row, where: Row | Row[] = {}): boolean =>
    Array.isArray(where)
      ? where.some((w) => match(r, w))
      : Object.entries(where).every(([k, v]) => matchValue(r[k], v));
  let id = rows.reduce((m, r) => Math.max(m, r.id ?? 0), 0);
  const repo = {
    rows,
    find: jest.fn(({ where }: { where?: Row | Row[] } = {}) =>
      Promise.resolve(rows.filter((r) => match(r, where))),
    ),
    findOne: jest.fn(({ where }: { where: Row | Row[] }) =>
      Promise.resolve(rows.find((r) => match(r, where)) ?? null),
    ),
    count: jest.fn(({ where }: { where: Row }) =>
      Promise.resolve(rows.filter((r) => match(r, where)).length),
    ),
    create: jest.fn((v: Row) => ({ ...v })),
    save: jest.fn((v: Row | Row[]) => {
      const list = Array.isArray(v) ? v : [v];
      for (const item of list) {
        if (!item.id) {
          item.id = ++id;
          item.createdAt ??= new Date();
          rows.push(item);
        }
      }
      return Promise.resolve(v);
    }),
    update: jest.fn((rowId: number, patch: Row) => {
      const row = rows.find((r) => r.id === rowId);
      if (row) Object.assign(row, patch);
      return Promise.resolve({});
    }),
    delete: jest.fn((where: Row) => {
      for (let i = rows.length - 1; i >= 0; i--) {
        if (match(rows[i], where)) rows.splice(i, 1);
      }
      return Promise.resolve({});
    }),
    manager: {} as any,
  };
  return repo;
}

/** Pesan error Nest berbentuk { error: { message } } — cocokkan isinya */
async function rejectsWith(promise: Promise<unknown>, text: string) {
  const err = await promise.then(
    () => {
      throw new Error('seharusnya ditolak');
    },
    (e: unknown) => e,
  );
  const response = (err as { getResponse?: () => unknown }).getResponse?.();
  expect(JSON.stringify(response ?? (err as Error).message)).toContain(text);
}

/** JPEG kecil yang lolos pemeriksaan isi berkas */
const selfie = () =>
  ({
    buffer: Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.alloc(4096),
    ]),
  }) as Express.Multer.File;

describe('AttendanceService', () => {
  const CLINIC = 10;
  const clinic = {
    id: CLINIC,
    operationalHours: {
      senin: '08:00-16:00',
      selasa: '08:00-16:00',
      rabu: '08:00-16:00',
      kamis: '08:00-16:00',
      jumat: '08:00-16:00',
      sabtu: '08:00-16:00',
      minggu: '08:00-16:00',
    },
    satusehatProfile: { latitude: -6.2, longitude: 106.816666 },
  };
  const nurse = { userId: 3, role: UserRole.PERAWAT, clinicId: CLINIC };
  const owner = { userId: 1, role: UserRole.OWNER, clinicId: CLINIC };
  const near = { latitude: -6.2003, longitude: 106.816666, accuracy: 10 };
  const far = { latitude: -6.2032, longitude: 106.816666, accuracy: 10 };

  let records: ReturnType<typeof memRepo>;
  let devices: ReturnType<typeof memRepo>;
  let schedules: ReturnType<typeof memRepo>;
  let service: AttendanceService;
  let config: AttendanceConfigService;

  beforeEach(() => {
    records = memRepo();
    devices = memRepo();
    schedules = memRepo();
    schedules.manager = {
      transaction: (cb: (em: any) => Promise<void>) =>
        cb({
          delete: (_e: unknown, where: Row) => schedules.delete(where),
          save: (_e: unknown, list: Row[]) => schedules.save(list),
          create: (_e: unknown, v: Row) => ({ ...v }),
        }),
    };
    const users = memRepo([
      {
        id: 1,
        clinicId: CLINIC,
        role: UserRole.OWNER,
        name: 'Owner',
        isActive: true,
      },
      {
        id: 2,
        clinicId: CLINIC,
        role: UserRole.ADMIN,
        name: 'Admin',
        isActive: true,
      },
      {
        id: 3,
        clinicId: CLINIC,
        role: UserRole.PERAWAT,
        name: 'Ns. Bunga',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        id: 9,
        clinicId: 99,
        role: UserRole.DOKTER,
        name: 'Klinik lain',
        isActive: true,
      },
    ]);
    config = new AttendanceConfigService(
      memRepo() as any,
      schedules as any,
      devices as any,
      memRepo([clinic]) as any,
      users as any,
    );
    service = new AttendanceService(records as any, users as any, config);
  });

  const clockIn = (
    pos: Row = near,
    token = 'token-hp-bunga-0001',
    photo: Express.Multer.File | null = selfie(),
  ) =>
    service.clock(
      'in',
      nurse,
      { ...pos, deviceToken: token, deviceName: 'Android · Chrome' } as any,
      photo ?? undefined,
    );
  const clockOut = (pos: Row = near, token = 'token-hp-bunga-0001') =>
    service.clock(
      'out',
      nurse,
      { ...pos, deviceToken: token } as any,
      selfie(),
    );

  it('clocks in and out inside the radius, on the first (auto-registered) device (positive)', async () => {
    const res = await clockIn();
    expect(res.location.status).toBe('inside');
    expect(res.deviceStatus).toBe('registered');
    expect(res.day.clockIn).toEqual(
      expect.objectContaining({
        location: 'inside',
        deviceName: 'Android · Chrome',
      }),
    );
    const out = await clockOut();
    expect(out.day.clockOut).not.toBeNull();
    expect(records.rows).toHaveLength(1);
  });

  it('never stores the selfie or the exact coordinates (positive)', async () => {
    await clockIn();
    const row = records.rows[0];
    const stored = JSON.stringify(row);
    expect(stored).not.toContain('-6.2003');
    expect(
      Object.keys(row).some((k) => /photo|lat|lng|longitude/i.test(k)),
    ).toBe(false);
    expect(row.clockInDistanceM).toBe(33);
  });

  it('still records a clock-in far from the clinic, with the distance (negative)', async () => {
    const res = await clockIn(far);
    expect(res.location.status).toBe('outside');
    expect(res.location.distanceM).toBeGreaterThan(340);
    expect(records.rows[0].clockInLocation).toBe('outside');
  });

  it('records a clock-in without location as "unknown" (edge)', async () => {
    const res = await clockIn({});
    expect(res.location.status).toBe('unknown');
    expect(records.rows).toHaveLength(1);
  });

  it('rejects a missing or fake selfie (negative)', async () => {
    await expect(clockIn(near, 'token-hp-bunga-0001', null)).rejects.toThrow(
      BadRequestException,
    );
    await rejectsWith(
      clockIn(near, 'token-hp-bunga-0001', {
        buffer: Buffer.concat([
          Buffer.from('not an image'),
          Buffer.alloc(4096),
        ]),
      } as any),
      'JPG, PNG, atau WEBP',
    );
    expect(records.rows).toHaveLength(0);
  });

  it('refuses double clock-in, clock-out before clock-in, and double clock-out (negative)', async () => {
    await rejectsWith(clockOut(), 'belum absen masuk');
    await clockIn();
    await expect(clockIn()).rejects.toThrow(ConflictException);
    await clockOut();
    await rejectsWith(clockOut(), 'sudah absen pulang');
  });

  it('flags a third device as new until the owner registers it, max 2 (edge)', async () => {
    await clockIn(near, 'token-hp-bunga-0001'); // HP: otomatis terdaftar
    const out = await clockOut(near, 'token-laptop-bunga-01'); // laptop: baru
    expect(out.deviceStatus).toBe('new');
    const laptop = devices.rows.find((d) => d.name === 'Perangkat tanpa nama');
    await config.registerDevice(CLINIC, laptop!.id, owner.userId);
    expect(devices.rows.find((d) => d.id === laptop!.id)!.isRegistered).toBe(
      true,
    );

    await config.resolveDevice(CLINIC, 3, 'token-tablet-bunga-1', 'Tablet');
    const tablet = devices.rows.find((d) => d.name === 'Tablet');
    expect(tablet!.isRegistered).toBe(false);
    await rejectsWith(
      config.registerDevice(CLINIC, tablet!.id, owner.userId),
      'sudah punya 2 perangkat',
    );
  });

  it('accepts a clinic device for every staff member without a flag (positive)', async () => {
    await config.markClinicDevice(
      CLINIC,
      'token-tablet-depan-01',
      'Tablet meja depan',
      1,
    );
    await clockIn(near, 'token-hp-bunga-0001');
    const res = await clockOut(near, 'token-tablet-depan-01');
    expect(res.deviceStatus).toBe('clinic');
  });

  it("shows today's board to the owner with counts (positive)", async () => {
    await clockIn(far);
    const board = await service.todayBoard(CLINIC);
    expect(board.rows.map((r) => r.name)).toEqual(['Admin', 'Ns. Bunga']);
    expect(board.counts.in).toBe(1);
    expect(board.counts.flagged).toBe(1);
  });

  it('corrects a forgotten clock-out with a reason, keeping the original time (positive)', async () => {
    await clockIn();
    const today = wibDate(new Date());
    const day = await service.correct(CLINIC, owner as any, {
      userId: 3,
      workDate: today,
      clockIn: '08:00',
      clockOut: '16:00',
      reason: 'Lupa absen pulang',
    });
    expect(day.correction).toEqual(
      expect.objectContaining({ reason: 'Lupa absen pulang', byName: 'Owner' }),
    );
    expect(records.rows[0].originalClockInAt).toBeInstanceOf(Date);
    expect(records.rows[0].originalClockOutAt ?? null).toBeNull();
  });

  it("refuses self-correction, other clinics' staff, and clock-out before clock-in (negative)", async () => {
    const today = wibDate(new Date());
    const dto = {
      workDate: today,
      clockIn: '08:00',
      clockOut: '16:00',
      reason: 'x',
    };
    await expect(
      service.correct(
        CLINIC,
        { userId: 2, role: UserRole.ADMIN, clinicId: CLINIC } as any,
        {
          ...dto,
          userId: 2,
        },
      ),
    ).rejects.toThrow(ForbiddenException);
    await rejectsWith(
      service.correct(CLINIC, owner as any, { ...dto, userId: 9 }),
      'Pegawai tidak ditemukan',
    );
    await expect(
      service.correct(CLINIC, owner as any, {
        ...dto,
        userId: 3,
        clockOut: '07:00',
      }),
    ).rejects.toThrow('setelah jam masuk');
  });

  it('builds a monthly recap that only counts days since the account existed (edge)', async () => {
    await clockIn(far);
    const recap = await service.recap(CLINIC);
    const bunga = recap.rows.find((r) => r.userId === 3)!;
    expect(bunga.presentDays).toBe(1);
    expect(bunga.outsideCount).toBe(1);
    // Admin tanpa createdAt dihitung sejak awal bulan; tidak ada hari di masa depan
    const days = (await service.userMonth(CLINIC, 3)).days;
    expect(days.every((d) => d.date <= wibDate(new Date()))).toBe(true);
  });

  it('does not count days before the clinic started using attendance as absent (edge)', async () => {
    // Belum ada yang absen: rekap kosong, bukan "tidak hadir" sebulan penuh
    const before = await service.recap(CLINIC);
    expect(
      before.rows.every((r) => r.workDays === 0 && r.absentDays === 0),
    ).toBe(true);

    await clockIn();
    // Admin tanpa createdAt: dihitung sejak absen pertama klinik (hari ini) saja
    const days = (await service.userMonth(CLINIC, 2)).days;
    expect(days.map((d) => d.date)).toEqual([wibDate(new Date())]);
  });

  it("uses a staff member's own schedule over the clinic default (positive)", async () => {
    const flexibleWeek = Array.from({ length: 7 }, () => ({
      mode: 'flexible' as const,
    }));
    await config.saveUserSchedule(CLINIC, 3, flexibleWeek as any, 1);
    const res = await clockIn();
    expect(res.day.schedule.mode).toBe('flexible');
    expect(res.day.lateMinutes).toBe(0);
    await config.saveUserSchedule(CLINIC, 3, null, 1);
    expect(
      (await config.schedules(CLINIC)).staff.find((s) => s.userId === 3)!.week,
    ).toBeNull();
  });

  it('rejects a schedule whose end is before its start (negative)', async () => {
    const week = Array.from({ length: 7 }, () => ({
      mode: 'work',
      start: '16:00',
      end: '08:00',
    }));
    await expect(
      config.saveClinicSchedule(CLINIC, week as any, 1),
    ).rejects.toThrow('Jam selesai harus setelah jam mulai');
  });
});
