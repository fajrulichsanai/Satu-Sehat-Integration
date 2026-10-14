import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import {
  AttendanceConfigService,
  EffectiveSettings,
  ScheduleBook,
} from './attendance-config.service';
import {
  DaySchedule,
  DayStatus,
  LocationStatus,
  classifyLocation,
  datesBetween,
  dayOfWeek,
  evaluateDay,
  hhmmToMinutes,
  monthRange,
  wibDate,
  wibDateTime,
  wibMinutes,
} from './attendance-rules';
import { assertSelfie } from './selfie-check';
import type { ClockDto, CorrectionDto } from './dto/attendance.dto';

export interface Actor {
  userId: number;
  role: string;
  clinicId: number;
  name?: string;
}

type ClockKind = 'in' | 'out';

interface ClockSideView {
  at: Date;
  location: LocationStatus | null;
  distanceM: number | null;
  accuracyM: number | null;
  deviceStatus: string | null;
  deviceName: string | null;
}

export interface DayView {
  date: string;
  status: DayStatus;
  lateMinutes: number;
  earlyMinutes: number;
  workedMinutes: number;
  schedule: DaySchedule;
  recordId: number | null;
  clockIn: ClockSideView | null;
  clockOut: ClockSideView | null;
  correction: {
    at: Date | null;
    byName: string | null;
    reason: string | null;
    originalClockIn: Date | null;
    originalClockOut: Date | null;
  } | null;
}

export interface RecapRow {
  userId: number;
  name: string;
  role: string;
  workDays: number;
  presentDays: number;
  lateCount: number;
  lateMinutes: number;
  earlyCount: number;
  earlyMinutes: number;
  absentDays: number;
  forgotClockOut: number;
  outsideCount: number;
  newDeviceCount: number;
  workedMinutes: number;
}

const OUTSIDE_FLAGS: (LocationStatus | null)[] = ['outside'];

interface DetailNames {
  devices: Map<number, string>;
  users: Map<number, string>;
}

/** Rekap tidak menampilkan nama perangkat/pengoreksi — lewati query-nya */
const NO_NAMES: DetailNames = { devices: new Map(), users: new Map() };

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectRepository(AttendanceRecord)
    private readonly recordRepo: Repository<AttendanceRecord>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly config: AttendanceConfigService,
  ) {}

  // ── Pegawai: absen masuk / pulang ─────────────────────────────────────

  async clock(
    kind: ClockKind,
    actor: Actor,
    dto: ClockDto,
    photo: Express.Multer.File | undefined,
  ) {
    // Foto hanya pencegah titip absen: diperiksa lalu dibuang, tidak disimpan
    assertSelfie(photo);

    const now = new Date();
    const workDate = wibDate(now);
    const { clinicId, userId } = actor;

    const existing = await this.recordRepo.findOne({
      where: { clinicId, userId, workDate },
    });
    if (kind === 'in' && existing?.clockInAt) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'ALREADY_CLOCKED_IN',
          message: 'Anda sudah absen masuk hari ini',
        },
      });
    }
    if (kind === 'out' && !existing?.clockInAt) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'NOT_CLOCKED_IN',
          message: 'Anda belum absen masuk hari ini',
        },
      });
    }
    if (kind === 'out' && existing?.clockOutAt) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'ALREADY_CLOCKED_OUT',
          message: 'Anda sudah absen pulang hari ini',
        },
      });
    }

    const [settings, device] = await Promise.all([
      this.config.settings(clinicId),
      this.config.resolveDevice(
        clinicId,
        userId,
        dto.deviceToken,
        dto.deviceName,
      ),
    ]);
    // Koordinat hanya dipakai di sini untuk menghitung jarak — tidak disimpan
    const location = classifyLocation(
      {
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy,
      },
      settings,
      settings.radiusM,
    );

    let record: AttendanceRecord;
    if (kind === 'in') {
      const book = await this.config.scheduleBook(clinicId);
      const schedule = this.config.daySchedule(
        book,
        userId,
        dayOfWeek(workDate),
      );
      record =
        existing ??
        this.recordRepo.create({
          clinicId,
          userId,
          workDate,
          createdBy: userId,
        });
      Object.assign(record, {
        scheduleMode: schedule.mode,
        scheduledStart: schedule.start,
        scheduledEnd: schedule.end,
        clockInAt: now,
        clockInLocation: location.status,
        clockInDistanceM: location.distanceM,
        clockInAccuracyM: location.accuracyM,
        clockInDeviceId: device.id,
        clockInDeviceStatus: device.status,
        updatedBy: userId,
      });
    } else {
      record = existing as AttendanceRecord;
      Object.assign(record, {
        clockOutAt: now,
        clockOutLocation: location.status,
        clockOutDistanceM: location.distanceM,
        clockOutAccuracyM: location.accuracyM,
        clockOutDeviceId: device.id,
        clockOutDeviceStatus: device.status,
        updatedBy: userId,
      });
    }

    try {
      record = await this.recordRepo.save(record);
    } catch (err) {
      // Dua ketukan bersamaan: baris unik (klinik, pegawai, tanggal) sudah ada
      if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
        throw new ConflictException({
          success: false,
          error: {
            code: 'ALREADY_CLOCKED_IN',
            message: 'Anda sudah absen masuk hari ini',
          },
        });
      }
      throw err;
    }

    this.logger.log(
      `[CLOCK-${kind.toUpperCase()}] clinicId=${clinicId} userId=${userId} location=${location.status} device=${device.status}`,
    );

    const [day] = await this.buildDays(
      clinicId,
      userId,
      [workDate],
      settings,
      null,
      new Map([[workDate, record]]),
    );
    return {
      day,
      location: {
        status: location.status,
        distanceM: location.distanceM,
        accuracyM: location.accuracyM,
        radiusM: settings.radiusM,
      },
      deviceStatus: device.status,
    };
  }

  /** Kartu absen: jadwal, absen hari ini, dan status perangkat ini */
  async todayForMe(actor: Actor, deviceToken?: string) {
    const now = new Date();
    const today = wibDate(now);
    const [settings, deviceStatus] = await Promise.all([
      this.config.settings(actor.clinicId),
      this.config.deviceStatusFor(actor.clinicId, actor.userId, deviceToken),
    ]);
    const [day] = await this.buildDays(
      actor.clinicId,
      actor.userId,
      [today],
      settings,
    );
    return {
      day,
      serverTime: now,
      radiusM: settings.radiusM,
      clinicLocationSet: settings.latitude !== null,
      deviceStatus,
    };
  }

  async myMonth(actor: Actor, month?: string) {
    return this.userMonth(actor.clinicId, actor.userId, month);
  }

  // ── Owner / admin ─────────────────────────────────────────────────────

  async todayBoard(clinicId: number) {
    const now = new Date();
    const today = wibDate(now);
    const [staff, settings, book, records] = await Promise.all([
      this.config.staff(clinicId),
      this.config.settings(clinicId),
      this.config.scheduleBook(clinicId),
      this.recordRepo.find({ where: { clinicId, workDate: today } }),
    ]);
    const recordByUser = new Map(records.map((r) => [r.userId, r]));
    // Pegawai yang dinonaktifkan hari ini tapi sudah absen tetap ditampilkan
    const extraIds = records
      .map((r) => r.userId)
      .filter((id) => !staff.some((u) => u.id === id));
    const extra = extraIds.length
      ? await this.userRepo.find({ where: { id: In(extraIds) } })
      : [];
    const people = [...staff, ...extra];

    const names = await this.detailNames(records);
    const rows = await Promise.all(
      people.map(async (u) => {
        const record = recordByUser.get(u.id) ?? null;
        const [day] = await this.buildDays(
          clinicId,
          u.id,
          [today],
          settings,
          book,
          new Map(record ? [[today, record]] : []),
          names,
        );
        return { userId: u.id, name: u.name, role: u.role, day };
      }),
    );
    const counts = {
      total: rows.length,
      in: rows.filter((r) => r.day.clockIn).length,
      late: rows.filter((r) => r.day.lateMinutes > 0).length,
      notYet: rows.filter((r) => r.day.status === 'not_in_yet').length,
      absent: rows.filter((r) => r.day.status === 'absent').length,
      flagged: rows.filter(
        (r) =>
          OUTSIDE_FLAGS.includes(r.day.clockIn?.location ?? null) ||
          OUTSIDE_FLAGS.includes(r.day.clockOut?.location ?? null) ||
          r.day.clockIn?.deviceStatus === 'new' ||
          r.day.clockOut?.deviceStatus === 'new',
      ).length,
    };
    return { date: today, serverTime: now, counts, rows };
  }

  async recap(clinicId: number, month?: string) {
    const target = month ?? wibDate(new Date()).slice(0, 7);
    const { from, to } = monthRange(target);
    const [staff, settings, book, records] = await Promise.all([
      this.config.staff(clinicId),
      this.config.settings(clinicId),
      this.config.scheduleBook(clinicId),
      this.recordRepo.find({
        where: { clinicId, workDate: Between(from, to) },
      }),
    ]);
    const byUser = new Map<number, Map<string, AttendanceRecord>>();
    for (const r of records) {
      const map = byUser.get(r.userId) ?? new Map<string, AttendanceRecord>();
      map.set(r.workDate, r);
      byUser.set(r.userId, map);
    }

    const rows: RecapRow[] = [];
    for (const u of staff) {
      const dates = this.datesFor(u, from, to);
      const days = await this.buildDays(
        clinicId,
        u.id,
        dates,
        settings,
        book,
        byUser.get(u.id) ?? new Map(),
        NO_NAMES,
      );
      rows.push(this.summarize(u, days));
    }
    return { month: target, from, to, rows };
  }

  async userMonth(clinicId: number, userId: number, month?: string) {
    const user = await this.config.assertStaff(clinicId, userId);
    const target = month ?? wibDate(new Date()).slice(0, 7);
    const { from, to } = monthRange(target);
    const settings = await this.config.settings(clinicId);
    const days = await this.buildDays(
      clinicId,
      userId,
      this.datesFor(user, from, to),
      settings,
    );
    return {
      month: target,
      user: { id: user.id, name: user.name, role: user.role },
      summary: this.summarize(user, days),
      days: [...days].reverse(),
    };
  }

  async correct(clinicId: number, actor: Actor, dto: CorrectionDto) {
    if (dto.userId === actor.userId) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: 'SELF_CORRECTION',
          message: 'Anda tidak bisa mengoreksi absen Anda sendiri',
        },
      });
    }
    await this.config.assertStaff(clinicId, dto.userId);
    const today = wibDate(new Date());
    if (dto.workDate > today) {
      throw new BadRequestException(
        'Tanggal koreksi tidak boleh di masa depan',
      );
    }
    const clockOut = dto.clockOut ?? null;
    if (clockOut && hhmmToMinutes(clockOut) <= hhmmToMinutes(dto.clockIn)) {
      throw new BadRequestException('Jam pulang harus setelah jam masuk');
    }

    const existing = await this.recordRepo.findOne({
      where: { clinicId, userId: dto.userId, workDate: dto.workDate },
    });
    let record: AttendanceRecord;
    if (existing) {
      record = existing;
      // Jam asli disimpan sekali, pada koreksi pertama
      if (!record.correctedAt) {
        record.originalClockInAt = record.clockInAt;
        record.originalClockOutAt = record.clockOutAt;
      }
    } else {
      const book = await this.config.scheduleBook(clinicId);
      const schedule = this.config.daySchedule(
        book,
        dto.userId,
        dayOfWeek(dto.workDate),
      );
      record = this.recordRepo.create({
        clinicId,
        userId: dto.userId,
        workDate: dto.workDate,
        scheduleMode: schedule.mode,
        scheduledStart: schedule.start,
        scheduledEnd: schedule.end,
        createdBy: actor.userId,
      });
    }
    record.clockInAt = wibDateTime(dto.workDate, dto.clockIn);
    record.clockOutAt = clockOut ? wibDateTime(dto.workDate, clockOut) : null;
    record.correctedBy = actor.userId;
    record.correctedAt = new Date();
    record.correctionReason = dto.reason.trim();
    record.updatedBy = actor.userId;
    record = await this.recordRepo.save(record);

    const settings = await this.config.settings(clinicId);
    const [day] = await this.buildDays(
      clinicId,
      dto.userId,
      [dto.workDate],
      settings,
      null,
      new Map([[dto.workDate, record]]),
    );
    return day;
  }

  // ── Bantuan ───────────────────────────────────────────────────────────

  /** Tanggal yang dihitung: sejak akun dibuat, sampai hari ini */
  private datesFor(user: User, from: string, to: string): string[] {
    const today = wibDate(new Date());
    const joined = user.createdAt ? wibDate(new Date(user.createdAt)) : from;
    const start = joined > from ? joined : from;
    const end = to < today ? to : today;
    return start <= end ? datesBetween(start, end) : [];
  }

  private async buildDays(
    clinicId: number,
    userId: number,
    dates: string[],
    settings: EffectiveSettings,
    book: ScheduleBook | null = null,
    records: Map<string, AttendanceRecord> | null = null,
    names: DetailNames | null = null,
  ): Promise<DayView[]> {
    if (dates.length === 0) return [];
    const scheduleBook = book ?? (await this.config.scheduleBook(clinicId));
    let recordMap = records;
    if (!recordMap) {
      const rows = await this.recordRepo.find({
        where: {
          clinicId,
          userId,
          workDate: Between(dates[0], dates[dates.length - 1]),
        },
      });
      recordMap = new Map(rows.map((r) => [r.workDate, r]));
    }

    const { devices: deviceNames, users: correctorNames } =
      names ?? (await this.detailNames([...recordMap.values()]));

    const now = new Date();
    const today = wibDate(now);
    const nowMinutes = wibMinutes(now);

    return dates.map((date) => {
      const record = recordMap.get(date) ?? null;
      const schedule: DaySchedule = record
        ? {
            mode: record.scheduleMode,
            start: record.scheduledStart,
            end: record.scheduledEnd,
          }
        : this.config.daySchedule(scheduleBook, userId, dayOfWeek(date));
      const result = evaluateDay({
        date,
        today,
        nowMinutes,
        schedule,
        record: record
          ? {
              scheduleMode: record.scheduleMode,
              scheduledStart: record.scheduledStart,
              scheduledEnd: record.scheduledEnd,
              clockInAt: record.clockInAt,
              clockOutAt: record.clockOutAt,
            }
          : null,
        toleranceMinutes: settings.toleranceMinutes,
      });
      const side = (kind: ClockKind): ClockSideView | null => {
        if (!record) return null;
        const at = kind === 'in' ? record.clockInAt : record.clockOutAt;
        if (!at) return null;
        const deviceId =
          kind === 'in' ? record.clockInDeviceId : record.clockOutDeviceId;
        return {
          at,
          location:
            kind === 'in' ? record.clockInLocation : record.clockOutLocation,
          distanceM:
            kind === 'in' ? record.clockInDistanceM : record.clockOutDistanceM,
          accuracyM:
            kind === 'in' ? record.clockInAccuracyM : record.clockOutAccuracyM,
          deviceStatus:
            kind === 'in'
              ? record.clockInDeviceStatus
              : record.clockOutDeviceStatus,
          deviceName: deviceId ? (deviceNames.get(deviceId) ?? null) : null,
        };
      };
      return {
        date,
        ...result,
        schedule,
        recordId: record?.id ?? null,
        clockIn: side('in'),
        clockOut: side('out'),
        correction: record?.correctedAt
          ? {
              at: record.correctedAt,
              byName: record.correctedBy
                ? (correctorNames.get(record.correctedBy) ?? null)
                : null,
              reason: record.correctionReason,
              originalClockIn: record.originalClockInAt,
              originalClockOut: record.originalClockOutAt,
            }
          : null,
      };
    });
  }

  private summarize(user: User, days: DayView[]): RecapRow {
    const count = (fn: (d: DayView) => boolean) => days.filter(fn).length;
    const sum = (fn: (d: DayView) => number) =>
      days.reduce((acc, d) => acc + fn(d), 0);
    return {
      userId: user.id,
      name: user.name,
      role: user.role,
      workDays: count((d) => d.schedule.mode === 'work'),
      presentDays: count((d) => d.clockIn !== null),
      lateCount: count((d) => d.lateMinutes > 0),
      lateMinutes: sum((d) => d.lateMinutes),
      earlyCount: count((d) => d.earlyMinutes > 0),
      earlyMinutes: sum((d) => d.earlyMinutes),
      absentDays: count((d) => d.status === 'absent'),
      forgotClockOut: count((d) => d.status === 'forgot_clock_out'),
      outsideCount: count(
        (d) =>
          OUTSIDE_FLAGS.includes(d.clockIn?.location ?? null) ||
          OUTSIDE_FLAGS.includes(d.clockOut?.location ?? null),
      ),
      newDeviceCount: count(
        (d) =>
          d.clockIn?.deviceStatus === 'new' ||
          d.clockOut?.deviceStatus === 'new',
      ),
      workedMinutes: sum((d) => d.workedMinutes),
    };
  }

  /** Nama perangkat & nama pengoreksi untuk sekumpulan baris, sekali query */
  private async detailNames(records: AttendanceRecord[]): Promise<DetailNames> {
    const deviceIds = records
      .flatMap((r) => [r.clockInDeviceId, r.clockOutDeviceId])
      .filter((id): id is number => id !== null);
    const userIds = [
      ...new Set(
        records
          .map((r) => r.correctedBy)
          .filter((id): id is number => id !== null),
      ),
    ];
    const [devices, users] = await Promise.all([
      this.config.deviceNames(deviceIds),
      userIds.length
        ? this.userRepo.find({ where: { id: In(userIds) } })
        : Promise.resolve([] as User[]),
    ]);
    return { devices, users: new Map(users.map((u) => [u.id, u.name])) };
  }
}
