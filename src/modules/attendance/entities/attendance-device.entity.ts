import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

/**
 * Perangkat yang dipakai absen, dikenali dari penanda acak di browser (yang
 * disimpan di sini hanya hash-nya). Maksimal 2 perangkat terdaftar per
 * pegawai; perangkat lain tetap boleh dipakai absen tapi diberi tanda.
 * Perangkat klinik (`userId` kosong) boleh dipakai semua pegawai.
 */
@Entity('attendance_devices')
@Index(['clinicId', 'tokenHash'])
@Index(['clinicId', 'userId'])
export class AttendanceDevice extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'is_registered', default: false })
  isRegistered: boolean;

  @Column({ name: 'is_clinic_device', default: false })
  isClinicDevice: boolean;

  @Column({ name: 'last_used_at', type: 'datetime', nullable: true })
  lastUsedAt: Date | null;
}
