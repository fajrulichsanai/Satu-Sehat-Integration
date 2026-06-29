import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Gender } from '../../../enums';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('practitioners')
@Index(['nik', 'clinicId'], { unique: true })
export class Practitioner extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'user_id', nullable: true })
  userId: number;

  @Column({ length: 16, nullable: true })
  nik: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'birth_date', type: 'date', nullable: true })
  birthDate: Date;

  @Column({
    type: 'enum',
    enum: Gender,
    nullable: true,
  })
  gender: Gender;

  @Column({ length: 100, nullable: true })
  specialization: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 100, nullable: true })
  email: string;

  @Column({ name: 'sip_number', length: 50, nullable: true })
  sipNumber: string;

  @Column({ name: 'satusehat_practitioner_id', length: 100, nullable: true })
  satusehatPractitionerId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
