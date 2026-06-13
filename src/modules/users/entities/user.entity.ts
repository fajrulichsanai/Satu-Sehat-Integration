import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { UserRole } from '../../../enums';
import { Clinic } from '../../clinics/entities/clinic.entity';

@Entity('users')
@Index(['role', 'isActive'])
export class User extends BaseEntity {
  @Column({ name: 'clinic_id', type: 'int', nullable: true })
  clinicId: number | null | undefined;

  @Column({ name: 'practitioner_id', type: 'int', nullable: true })
  practitionerId: number | null | undefined;

  @Column({ length: 100, unique: true })
  email: string | undefined;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash: string | undefined;

  @Column({ length: 100 })
  name: string | undefined;

  @Column({
    type: 'enum',
    enum: UserRole,
  })
  role: UserRole | undefined;

  @Column({ name: 'is_active', default: false })
  isActive: boolean | undefined;

  @Column({ name: 'email_verified_at', nullable: true })
  emailVerifiedAt: Date | undefined;

  @Column({ name: 'verification_token', length: 100, nullable: true })
  verificationToken: string | undefined;

  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt: Date | undefined;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic | undefined;
}
