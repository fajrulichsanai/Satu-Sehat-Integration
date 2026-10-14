/**
 * Aturan absensi sebagai fungsi murni (tanpa database) supaya mudah diuji:
 * waktu WIB, jadwal kerja, jarak ke klinik, dan status kehadiran per hari.
 * Semua jam memakai WIB (UTC+7), sama dengan zona waktu koneksi database.
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DayMode = 'work' | 'off' | 'flexible';

export interface DaySchedule {
  mode: DayMode;
  /** 'HH:mm', hanya untuk mode 'work' */
  start: string | null;
  end: string | null;
}

/** Indeks 0 = Minggu … 6 = Sabtu (sama dengan Date.getUTCDay) */
export type WeekSchedule = DaySchedule[];

export type LocationStatus =
  | 'inside'
  | 'outside'
  | 'inaccurate'
  | 'unknown'
  | 'clinic_unset';

export type DeviceStatus = 'registered' | 'new' | 'clinic';

export type DayStatus =
  | 'present'
  | 'late'
  | 'early_leave'
  | 'working'
  | 'forgot_clock_out'
  | 'not_in_yet'
  | 'absent'
  | 'off';

export const OFF_DAY: DaySchedule = { mode: 'off', start: null, end: null };
export const FLEXIBLE_DAY: DaySchedule = {
  mode: 'flexible',
  start: null,
  end: null,
};

/** Nama hari di jam operasional klinik (`clinics.operational_hours`) */
const OPERATIONAL_DAY_KEYS = [
  'minggu',
  'senin',
  'selasa',
  'rabu',
  'kamis',
  'jumat',
  'sabtu',
];

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isHHmm(value: unknown): value is string {
  return typeof value === 'string' && HHMM.test(value);
}

export function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Tanggal WIB 'YYYY-MM-DD' dari sebuah waktu */
export function wibDate(at: Date): string {
  return new Date(at.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Menit sejak tengah malam WIB */
export function wibMinutes(at: Date): number {
  const wib = new Date(at.getTime() + WIB_OFFSET_MS);
  return wib.getUTCHours() * 60 + wib.getUTCMinutes();
}

/** Waktu sebenarnya dari tanggal WIB + jam 'HH:mm' WIB */
export function wibDateTime(date: string, hhmm: string): Date {
  const [y, mo, d] = date.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - WIB_OFFSET_MS);
}

export function dayOfWeek(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

export function addDays(date: string, days: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Semua tanggal 'YYYY-MM-DD' dari `from` sampai `to` (inklusif) */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Hari pertama & terakhir bulan 'YYYY-MM' */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
  };
}

/**
 * Jadwal mingguan dari jam operasional klinik ("08:00-16:00" / "Tutup").
 * Tanpa jam operasional sama sekali → fleksibel (tidak ada status terlambat
 * atau tidak hadir), supaya klinik yang belum mengisi jadwal tidak melihat
 * semua pegawainya "tidak hadir".
 */
export function weekFromOperationalHours(
  hours: Record<string, unknown> | null | undefined,
): WeekSchedule {
  if (!hours || Object.keys(hours).length === 0) {
    return OPERATIONAL_DAY_KEYS.map(() => ({ ...FLEXIBLE_DAY }));
  }
  return OPERATIONAL_DAY_KEYS.map((key) => {
    const raw = hours[key];
    if (typeof raw !== 'string') return { ...OFF_DAY };
    const [start, end] = raw.split('-').map((s) => s.trim());
    if (
      isHHmm(start) &&
      isHHmm(end) &&
      hhmmToMinutes(end) > hhmmToMinutes(start)
    ) {
      return { mode: 'work', start, end };
    }
    return { ...OFF_DAY };
  });
}

/** Jarak dua titik di permukaan bumi dalam meter (rumus haversine) */
export function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface PositionInput {
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
}

export interface LocationResult {
  status: LocationStatus;
  distanceM: number | null;
  accuracyM: number | null;
}

/**
 * Posisi pegawai dibanding titik klinik. Absen tidak pernah ditolak karena
 * lokasi — hasil ini hanya menentukan tanda yang dilihat owner.
 */
export function classifyLocation(
  position: PositionInput,
  clinic: { latitude: number | null; longitude: number | null },
  radiusM: number,
): LocationResult {
  const accuracyM =
    typeof position.accuracy === 'number' && Number.isFinite(position.accuracy)
      ? Math.round(position.accuracy)
      : null;
  const hasPosition =
    typeof position.latitude === 'number' &&
    typeof position.longitude === 'number';
  if (!hasPosition) return { status: 'unknown', distanceM: null, accuracyM };
  if (clinic.latitude === null || clinic.longitude === null) {
    return { status: 'clinic_unset', distanceM: null, accuracyM };
  }
  const distanceM = Math.round(
    haversineMeters(
      clinic.latitude,
      clinic.longitude,
      position.latitude as number,
      position.longitude as number,
    ),
  );
  if (distanceM <= radiusM) return { status: 'inside', distanceM, accuracyM };
  // GPS yang kasar (mis. di dalam gedung) tidak dianggap "di luar lokasi"
  if (accuracyM !== null && accuracyM > radiusM) {
    return { status: 'inaccurate', distanceM, accuracyM };
  }
  return { status: 'outside', distanceM, accuracyM };
}

export interface DayRecordInput {
  scheduleMode: DayMode;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  clockInAt: Date | null;
  clockOutAt: Date | null;
}

export interface DayResult {
  status: DayStatus;
  /** Menit terlambat dari jam masuk (0 bila masih dalam toleransi) */
  lateMinutes: number;
  /** Menit lebih awal dari jam pulang */
  earlyMinutes: number;
  /** Durasi masuk–pulang dalam menit */
  workedMinutes: number;
}

/**
 * Status satu pegawai pada satu tanggal. Untuk hari yang sudah ada absennya,
 * jadwal yang dipakai adalah jadwal saat absen masuk (`record`), bukan jadwal
 * sekarang — perubahan jadwal tidak mengubah riwayat.
 */
export function evaluateDay(args: {
  date: string;
  today: string;
  nowMinutes: number;
  schedule: DaySchedule;
  record: DayRecordInput | null;
  toleranceMinutes: number;
}): DayResult {
  const { date, today, nowMinutes, schedule, record, toleranceMinutes } = args;
  const empty = { lateMinutes: 0, earlyMinutes: 0, workedMinutes: 0 };

  if (!record?.clockInAt) {
    if (schedule.mode !== 'work') return { status: 'off', ...empty };
    if (date < today) return { status: 'absent', ...empty };
    if (date > today) return { status: 'off', ...empty };
    const end = schedule.end ? hhmmToMinutes(schedule.end) : 24 * 60;
    return { status: nowMinutes > end ? 'absent' : 'not_in_yet', ...empty };
  }

  const inMin = wibMinutes(record.clockInAt);
  const outMin = record.clockOutAt ? wibMinutes(record.clockOutAt) : null;
  const workedMinutes = record.clockOutAt
    ? Math.max(
        0,
        Math.round(
          (record.clockOutAt.getTime() - record.clockInAt.getTime()) / 60000,
        ),
      )
    : 0;

  let lateMinutes = 0;
  let earlyMinutes = 0;
  if (
    record.scheduleMode === 'work' &&
    record.scheduledStart &&
    record.scheduledEnd
  ) {
    const start = hhmmToMinutes(record.scheduledStart);
    const end = hhmmToMinutes(record.scheduledEnd);
    if (inMin > start + toleranceMinutes) lateMinutes = inMin - start;
    if (outMin !== null && outMin < end) earlyMinutes = end - outMin;
  }

  let status: DayStatus;
  if (outMin === null) {
    status = date < today ? 'forgot_clock_out' : 'working';
  } else if (lateMinutes > 0) {
    status = 'late';
  } else if (earlyMinutes > 0) {
    status = 'early_leave';
  } else {
    status = 'present';
  }
  // Masih bekerja tapi terlambat masuk: tampilkan sebagai terlambat
  if (status === 'working' && lateMinutes > 0) status = 'late';
  return { status, lateMinutes, earlyMinutes, workedMinutes };
}
