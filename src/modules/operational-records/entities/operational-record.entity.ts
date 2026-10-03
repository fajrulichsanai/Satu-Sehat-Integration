import { Entity, Column, ManyToOne, JoinColumn, Index, ValueTransformer } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

// MySQL 'bigint' columns are returned by TypeORM as strings to avoid JS
// precision loss; nominal is a money amount well within Number.MAX_SAFE_INTEGER,
// so convert it back to a number to keep API responses consistent with the DTO type.
const bigintNumberTransformer: ValueTransformer = {
  to: (value?: number) => value,
  from: (value?: string) => (value === null || value === undefined ? value : Number(value)),
};

@Entity('operational_records')
@Index(['clinicId'])
@Index(['clinicId', 'tanggal'])
export class OperationalRecord extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ type: 'date' })
  tanggal: string;

  @Column({ length: 50 })
  kategori: string;

  @Column('text')
  deskripsi: string;

  @Column('bigint', { transformer: bigintNumberTransformer })
  nominal: number;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
