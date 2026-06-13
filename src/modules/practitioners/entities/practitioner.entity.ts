import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Gender } from '../../../enums';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('practitioners')
@Index(['nik', 'clinicId'], { unique: true })
export class Practitioner extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number | undefined;

  @Column({ name: 'user_id', nullable: true })
  userId: number | undefined;

  @Column({ length: 16, nullable: true })
  nik: string | undefined;

  @Column({ length: 100 })
  name: string | undefined;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: Date | undefined;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender: Gender | undefined;

  @Column({ length: 100, nullable: true })
  specialization: string | undefined;

  @Column({ name: 'satusehat_practitioner_id', length: 100, nullable: true })
  satusehatPractitionerId: string | undefined;

  @Column({ name: 'is_active', default: true })
  isActive: boolean | undefined;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic | undefined;
}
