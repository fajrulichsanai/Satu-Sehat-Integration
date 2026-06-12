import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/base.entity';
import { Gender } from '../enums';
import { Clinic } from './clinic.entity';

@Entity('practitioners')
@Index(['nik', 'clinicId'], { unique: true })
export class Practitioner extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ length: 16 })
  nik: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'birth_date', type: 'date' })
  birthDate: Date;

  @Column({
    type: 'enum',
    enum: Gender,
  })
  gender: Gender;

  @Column({ length: 100, nullable: true })
  specialization: string;

  @Column({ name: 'satusehat_practitioner_id', length: 100, nullable: true })
  satusehatPractitionerId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
