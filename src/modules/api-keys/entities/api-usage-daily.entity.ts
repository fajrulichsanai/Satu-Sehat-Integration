import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Request count per key per day (Asia/Jakarta), for quotas and the usage chart. */
@Entity('api_usage_daily')
@Index(['apiKeyId', 'date'], { unique: true })
@Index(['clinicId', 'date'])
export class ApiUsageDaily {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_id', type: 'int' })
  clinicId: number;

  @Column({ name: 'api_key_id', type: 'int' })
  apiKeyId: number;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'int', default: 0 })
  count: number;
}
