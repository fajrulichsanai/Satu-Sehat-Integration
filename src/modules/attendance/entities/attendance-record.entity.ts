import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import type {
  DayMode,
  DeviceStatus,
  LocationStatus,
} from '../attendance-rules';

/**
 * Satu baris = satu pegawai, satu hari kerja, satu klinik. Foto selfie dan
 * koordinat persis TIDAK disimpan — hanya jarak ke klinik dan tandanya.
 * Jadwal hari itu disalin saat absen masuk supaya perubahan jadwal
 * belakangan tidak mengubah riwayat (terlambat/pulang cepat).
 */
@Entity('attendance_records')
@Index(['clinicId', 'userId', 'workDate'], { unique: true })
@Index(['clinicId', 'workDate'])
export class AttendanceRecord extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  @Column({ name: 'schedule_mode', type: 'varchar', length: 10 })
  scheduleMode: DayMode;

  @Column({
    name: 'scheduled_start',
    type: 'varchar',
    length: 5,
    nullable: true,
  })
  scheduledStart: string | null;

  @Column({ name: 'scheduled_end', type: 'varchar', length: 5, nullable: true })
  scheduledEnd: string | null;

  @Column({ name: 'clock_in_at', type: 'datetime', nullable: true })
  clockInAt: Date | null;

  @Column({
    name: 'clock_in_location',
    type: 'varchar',
    length: 15,
    nullable: true,
  })
  clockInLocation: LocationStatus | null;

  @Column({ name: 'clock_in_distance_m', type: 'int', nullable: true })
  clockInDistanceM: number | null;

  @Column({ name: 'clock_in_accuracy_m', type: 'int', nullable: true })
  clockInAccuracyM: number | null;

  @Column({ name: 'clock_in_device_id', type: 'int', nullable: true })
  clockInDeviceId: number | null;

  @Column({
    name: 'clock_in_device_status',
    type: 'varchar',
    length: 12,
    nullable: true,
  })
  clockInDeviceStatus: DeviceStatus | null;

  @Column({ name: 'clock_out_at', type: 'datetime', nullable: true })
  clockOutAt: Date | null;

  @Column({
    name: 'clock_out_location',
    type: 'varchar',
    length: 15,
    nullable: true,
  })
  clockOutLocation: LocationStatus | null;

  @Column({ name: 'clock_out_distance_m', type: 'int', nullable: true })
  clockOutDistanceM: number | null;

  @Column({ name: 'clock_out_accuracy_m', type: 'int', nullable: true })
  clockOutAccuracyM: number | null;

  @Column({ name: 'clock_out_device_id', type: 'int', nullable: true })
  clockOutDeviceId: number | null;

  @Column({
    name: 'clock_out_device_status',
    type: 'varchar',
    length: 12,
    nullable: true,
  })
  clockOutDeviceStatus: DeviceStatus | null;

  // ── Koreksi oleh owner/admin (jam asli tetap tersimpan) ──

  @Column({ name: 'original_clock_in_at', type: 'datetime', nullable: true })
  originalClockInAt: Date | null;

  @Column({ name: 'original_clock_out_at', type: 'datetime', nullable: true })
  originalClockOutAt: Date | null;

  @Column({ name: 'corrected_by', type: 'int', nullable: true })
  correctedBy: number | null;

  @Column({ name: 'corrected_at', type: 'datetime', nullable: true })
  correctedAt: Date | null;

  @Column({
    name: 'correction_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  correctionReason: string | null;
}
