import { Column, Entity, Index, ValueTransformer } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';

// MySQL DECIMAL dibaca sebagai string; koordinat dipakai sebagai angka.
const decimalNumber: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) =>
    value === null || value === undefined ? null : Number(value),
};

/** Pengaturan absensi per klinik. Tanpa baris = nilai bawaan. */
@Entity('attendance_settings')
@Index(['clinicId'], { unique: true })
export class AttendanceSetting extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'tolerance_minutes', type: 'int', default: 10 })
  toleranceMinutes: number;

  @Column({ name: 'radius_m', type: 'int', default: 100 })
  radiusM: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: decimalNumber,
  })
  latitude: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: decimalNumber,
  })
  longitude: number | null;
}
