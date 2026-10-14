import { createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../enums';
import { AttendanceSetting } from './entities/attendance-setting.entity';
import { WorkSchedule } from './entities/work-schedule.entity';
import { AttendanceDevice } from './entities/attendance-device.entity';
import {
  DaySchedule,
  DeviceStatus,
  WeekSchedule,
  hhmmToMinutes,
  weekFromOperationalHours,
} from './attendance-rules';
import type { DayScheduleDto, SettingsDto } from './dto/attendance.dto';

/** Pegawai yang absen. Owner tidak absen. */
export const STAFF_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.DOKTER,
  UserRole.PERAWAT,
];

export const MAX_REGISTERED_DEVICES = 2;

export const DEFAULT_TOLERANCE_MINUTES = 10;
export const DEFAULT_RADIUS_M = 100;

export interface EffectiveSettings {
  toleranceMinutes: number;
  radiusM: number;
  latitude: number | null;
  longitude: number | null;
  /** Dari mana titik klinik diambil */
  locationSource: 'attendance' | 'satusehat' | null;
}

export interface ScheduleBook {
  clinicWeek: WeekSchedule;
  clinicSource: 'custom' | 'operational_hours';
  userWeeks: Map<number, WeekSchedule>;
}

export interface ResolvedDevice {
  id: number;
  status: DeviceStatus;
}

export function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function cleanDeviceName(name?: string | null): string {
  const trimmed = (name ?? '').replace(/\s+/g, ' ').trim().slice(0, 100);
  return trimmed || 'Perangkat tanpa nama';
}

@Injectable()
export class AttendanceConfigService {
  constructor(
    @InjectRepository(AttendanceSetting)
    private readonly settingRepo: Repository<AttendanceSetting>,
    @InjectRepository(WorkSchedule)
    private readonly scheduleRepo: Repository<WorkSchedule>,
    @InjectRepository(AttendanceDevice)
    private readonly deviceRepo: Repository<AttendanceDevice>,
    @InjectRepository(Clinic) private readonly clinicRepo: Repository<Clinic>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  // ── Pegawai ───────────────────────────────────────────────────────────

  staff(clinicId: number): Promise<User[]> {
    return this.userRepo.find({
      where: { clinicId, role: In(STAFF_ROLES), isActive: true },
      order: { name: 'ASC' },
    });
  }

  async assertStaff(clinicId: number, userId: number): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: userId, clinicId },
    });
    if (!user || !STAFF_ROLES.includes(user.role)) {
      throw new NotFoundException({
        success: false,
        error: { code: 'STAFF_NOT_FOUND', message: 'Pegawai tidak ditemukan' },
      });
    }
    return user;
  }

  // ── Pengaturan (toleransi, radius, titik klinik) ──────────────────────

  async settings(clinicId: number): Promise<EffectiveSettings> {
    const row = await this.settingRepo.findOne({ where: { clinicId } });
    const base = {
      toleranceMinutes: row?.toleranceMinutes ?? DEFAULT_TOLERANCE_MINUTES,
      radiusM: row?.radiusM ?? DEFAULT_RADIUS_M,
    };
    if (row?.latitude != null && row?.longitude != null) {
      return {
        ...base,
        latitude: row.latitude,
        longitude: row.longitude,
        locationSource: 'attendance',
      };
    }
    // Belum diatur: pakai koordinat profil SATUSEHAT bila ada
    const clinic = await this.clinicRepo.findOne({
      where: { id: clinicId },
      select: { id: true, satusehatProfile: true },
    });
    const lat = Number(clinic?.satusehatProfile?.latitude);
    const lng = Number(clinic?.satusehatProfile?.longitude);
    if (
      clinic?.satusehatProfile?.latitude != null &&
      clinic?.satusehatProfile?.longitude != null &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      return {
        ...base,
        latitude: lat,
        longitude: lng,
        locationSource: 'satusehat',
      };
    }
    return { ...base, latitude: null, longitude: null, locationSource: null };
  }

  async saveSettings(clinicId: number, dto: SettingsDto, by: number) {
    const hasLat = dto.latitude !== undefined && dto.latitude !== null;
    const hasLng = dto.longitude !== undefined && dto.longitude !== null;
    if (hasLat !== hasLng) {
      throw new BadRequestException('Lintang dan bujur harus diisi bersamaan');
    }
    const row =
      (await this.settingRepo.findOne({ where: { clinicId } })) ??
      this.settingRepo.create({ clinicId, createdBy: by });
    row.toleranceMinutes = dto.toleranceMinutes;
    row.radiusM = dto.radiusM;
    if (dto.latitude !== undefined) row.latitude = dto.latitude;
    if (dto.longitude !== undefined) row.longitude = dto.longitude;
    row.updatedBy = by;
    await this.settingRepo.save(row);
    return this.settings(clinicId);
  }

  // ── Jadwal kerja ──────────────────────────────────────────────────────

  async scheduleBook(clinicId: number): Promise<ScheduleBook> {
    const [rows, clinic] = await Promise.all([
      this.scheduleRepo.find({ where: { clinicId } }),
      this.clinicRepo.findOne({
        where: { id: clinicId },
        select: { id: true, operationalHours: true },
      }),
    ]);
    const toWeek = (list: WorkSchedule[]): WeekSchedule | null => {
      if (list.length === 0) return null;
      const week: WeekSchedule = Array.from({ length: 7 }, () => ({
        mode: 'off' as const,
        start: null,
        end: null,
      }));
      for (const r of list) {
        if (r.dayOfWeek >= 0 && r.dayOfWeek <= 6) {
          week[r.dayOfWeek] = {
            mode: r.mode,
            start: r.mode === 'work' ? r.startTime : null,
            end: r.mode === 'work' ? r.endTime : null,
          };
        }
      }
      return week;
    };

    const custom = toWeek(rows.filter((r) => r.userId === null));
    const byUser = new Map<number, WorkSchedule[]>();
    for (const r of rows) {
      if (r.userId === null) continue;
      byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);
    }
    const userWeeks = new Map<number, WeekSchedule>();
    for (const [userId, list] of byUser) {
      const week = toWeek(list);
      if (week) userWeeks.set(userId, week);
    }
    return {
      clinicWeek: custom ?? weekFromOperationalHours(clinic?.operationalHours),
      clinicSource: custom ? 'custom' : 'operational_hours',
      userWeeks,
    };
  }

  daySchedule(book: ScheduleBook, userId: number, dow: number): DaySchedule {
    return (book.userWeeks.get(userId) ?? book.clinicWeek)[dow];
  }

  async schedules(clinicId: number) {
    const [book, staff] = await Promise.all([
      this.scheduleBook(clinicId),
      this.staff(clinicId),
    ]);
    return {
      clinic: book.clinicWeek,
      clinicSource: book.clinicSource,
      staff: staff.map((u) => ({
        userId: u.id,
        name: u.name,
        role: u.role,
        week: book.userWeeks.get(u.id) ?? null,
      })),
    };
  }

  async saveClinicSchedule(
    clinicId: number,
    days: DayScheduleDto[],
    by: number,
  ) {
    const week = this.validateWeek(days);
    await this.replaceWeek(clinicId, null, week, by);
    return this.schedules(clinicId);
  }

  async saveUserSchedule(
    clinicId: number,
    userId: number,
    days: DayScheduleDto[] | null,
    by: number,
  ) {
    await this.assertStaff(clinicId, userId);
    const week = days ? this.validateWeek(days) : null;
    await this.replaceWeek(clinicId, userId, week, by);
    return this.schedules(clinicId);
  }

  private validateWeek(days: DayScheduleDto[]): WeekSchedule {
    return days.map((d, i) => {
      if (d.mode !== 'work') return { mode: d.mode, start: null, end: null };
      const start = d.start as string;
      const end = d.end as string;
      if (hhmmToMinutes(end) <= hhmmToMinutes(start)) {
        throw new BadRequestException(
          `Jam selesai harus setelah jam mulai (${['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][i]})`,
        );
      }
      return { mode: 'work', start, end };
    });
  }

  private async replaceWeek(
    clinicId: number,
    userId: number | null,
    week: WeekSchedule | null,
    by: number,
  ) {
    await this.scheduleRepo.manager.transaction(async (em) => {
      await em.delete(WorkSchedule, {
        clinicId,
        userId: userId === null ? IsNull() : userId,
      });
      if (!week) return;
      await em.save(
        WorkSchedule,
        week.map((d, dayOfWeek) =>
          em.create(WorkSchedule, {
            clinicId,
            userId,
            dayOfWeek,
            mode: d.mode,
            startTime: d.start,
            endTime: d.end,
            createdBy: by,
            updatedBy: by,
          }),
        ),
      );
    });
  }

  // ── Perangkat ─────────────────────────────────────────────────────────

  /**
   * Perangkat yang dipakai absen. Perangkat klinik dikenali lebih dulu.
   * Perangkat pertama seorang pegawai langsung terdaftar; perangkat
   * berikutnya dicatat sebagai "baru" sampai owner mendaftarkannya.
   */
  async resolveDevice(
    clinicId: number,
    userId: number,
    token: string,
    name?: string,
  ): Promise<ResolvedDevice> {
    const tokenHash = hashDeviceToken(token);
    const now = new Date();

    const clinicDevice = await this.deviceRepo.findOne({
      where: { clinicId, tokenHash, isClinicDevice: true },
    });
    if (clinicDevice) {
      await this.deviceRepo.update(clinicDevice.id, { lastUsedAt: now });
      return { id: clinicDevice.id, status: 'clinic' };
    }

    const own = await this.deviceRepo.findOne({
      where: { clinicId, userId, tokenHash },
    });
    if (own) {
      await this.deviceRepo.update(own.id, { lastUsedAt: now });
      return { id: own.id, status: own.isRegistered ? 'registered' : 'new' };
    }

    const registered = await this.deviceRepo.count({
      where: { clinicId, userId, isRegistered: true },
    });
    const created = await this.deviceRepo.save(
      this.deviceRepo.create({
        clinicId,
        userId,
        tokenHash,
        name: cleanDeviceName(name),
        isRegistered: registered === 0,
        isClinicDevice: false,
        lastUsedAt: now,
        createdBy: userId,
        updatedBy: userId,
      }),
    );
    return {
      id: created.id,
      status: created.isRegistered ? 'registered' : 'new',
    };
  }

  async deviceStatusFor(
    clinicId: number,
    userId: number,
    token: string | undefined,
  ): Promise<DeviceStatus | 'unknown'> {
    if (!token) return 'unknown';
    const tokenHash = hashDeviceToken(token);
    const device = await this.deviceRepo.findOne({
      where: [
        { clinicId, tokenHash, isClinicDevice: true },
        { clinicId, userId, tokenHash },
      ],
    });
    if (!device) {
      const registered = await this.deviceRepo.count({
        where: { clinicId, userId, isRegistered: true },
      });
      // Perangkat pertama akan langsung terdaftar saat absen
      return registered === 0 ? 'registered' : 'new';
    }
    if (device.isClinicDevice) return 'clinic';
    return device.isRegistered ? 'registered' : 'new';
  }

  async devices(clinicId: number) {
    const rows = await this.deviceRepo.find({
      where: { clinicId },
      order: { lastUsedAt: 'DESC' },
    });
    const userIds = [
      ...new Set(
        rows.map((r) => r.userId).filter((id): id is number => id !== null),
      ),
    ];
    const users = userIds.length
      ? await this.userRepo.find({ where: { id: In(userIds) } })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.name]));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      userId: r.userId,
      userName: r.userId ? (nameById.get(r.userId) ?? null) : null,
      isRegistered: r.isRegistered,
      isClinicDevice: r.isClinicDevice,
      lastUsedAt: r.lastUsedAt,
      createdAt: r.createdAt,
    }));
  }

  async deviceNames(ids: number[]): Promise<Map<number, string>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await this.deviceRepo.find({ where: { id: In(unique) } });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  async registerDevice(clinicId: number, id: number, by: number) {
    const device = await this.findDevice(clinicId, id);
    if (device.isClinicDevice || device.isRegistered)
      return this.devices(clinicId);
    const registered = await this.deviceRepo.count({
      where: { clinicId, userId: device.userId as number, isRegistered: true },
    });
    if (registered >= MAX_REGISTERED_DEVICES) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'DEVICE_LIMIT',
          message: `Pegawai ini sudah punya ${MAX_REGISTERED_DEVICES} perangkat terdaftar. Hapus salah satu dulu.`,
        },
      });
    }
    await this.deviceRepo.update(device.id, {
      isRegistered: true,
      updatedBy: by,
    });
    return this.devices(clinicId);
  }

  async removeDevice(clinicId: number, id: number) {
    const device = await this.findDevice(clinicId, id);
    await this.deviceRepo.delete({ id: device.id });
    return this.devices(clinicId);
  }

  /** Owner menandai perangkat yang sedang dipakainya sebagai perangkat klinik */
  async markClinicDevice(
    clinicId: number,
    token: string,
    name: string | undefined,
    by: number,
  ) {
    const tokenHash = hashDeviceToken(token);
    const existing = await this.deviceRepo.findOne({
      where: { clinicId, tokenHash, isClinicDevice: true },
    });
    if (existing) {
      await this.deviceRepo.update(existing.id, {
        name: cleanDeviceName(name ?? existing.name),
        updatedBy: by,
      });
    } else {
      await this.deviceRepo.save(
        this.deviceRepo.create({
          clinicId,
          userId: null,
          tokenHash,
          name: cleanDeviceName(name),
          isRegistered: true,
          isClinicDevice: true,
          createdBy: by,
          updatedBy: by,
        }),
      );
    }
    return this.devices(clinicId);
  }

  private async findDevice(clinicId: number, id: number) {
    const device = await this.deviceRepo.findOne({ where: { id, clinicId } });
    if (!device) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'DEVICE_NOT_FOUND',
          message: 'Perangkat tidak ditemukan',
        },
      });
    }
    return device;
  }
}
