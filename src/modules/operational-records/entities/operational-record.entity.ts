import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Clinic } from '../../clinics/entities/clinic.entity';

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

  @Column('bigint')
  nominal: number;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
