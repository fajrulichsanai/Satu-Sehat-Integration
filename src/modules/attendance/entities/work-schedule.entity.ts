import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import type { DayMode } from '../attendance-rules';

/**
 * Jadwal kerja per hari dalam seminggu. `userId` kosong = jadwal bawaan
 * klinik; terisi = jadwal khusus seorang pegawai (menggantikan bawaan untuk
 * seluruh minggu). Tanpa baris bawaan, jadwal diambil dari jam operasional.
 */
@Entity('work_schedules')
@Index(['clinicId', 'userId'])
export class WorkSchedule extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  /** 0 = Minggu … 6 = Sabtu */
  @Column({ name: 'day_of_week', type: 'tinyint' })
  dayOfWeek: number;

  @Column({ type: 'varchar', length: 10 })
  mode: DayMode;

  @Column({ name: 'start_time', type: 'varchar', length: 5, nullable: true })
  startTime: string | null;

  @Column({ name: 'end_time', type: 'varchar', length: 5, nullable: true })
  endTime: string | null;
}
