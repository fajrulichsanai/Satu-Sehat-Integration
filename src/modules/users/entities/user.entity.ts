import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { UserRole } from '../../../enums';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('users')
@Index(['role', 'isActive'])
export class User extends BaseEntity {
  @Column({ name: 'clinic_id', type: 'int', nullable: true })
  clinicId: number | null;

  @Column({ name: 'practitioner_id', type: 'int', nullable: true })
  practitionerId: number | null;

  @Column({ length: 100, unique: true })
  email: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role: UserRole;

  @Column({ name: 'is_active', default: false })
  isActive: boolean;

  @Column({ name: 'email_verified_at', nullable: true })
  emailVerifiedAt: Date;

  @Column({ name: 'verification_token', length: 100, nullable: true })
  verificationToken: string;

  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt: Date;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
