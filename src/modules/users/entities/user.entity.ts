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

  // Encrypted TOTP secret (see mfa.util) — set as soon as setup starts, but
  // only "live" (gating login) once mfaEnabled is true.
  @Column({ name: 'mfa_secret', length: 255, nullable: true })
  mfaSecret: string | null;

  @Column({ name: 'mfa_enabled', default: false })
  mfaEnabled: boolean;

  @Column({ name: 'mfa_enabled_at', nullable: true })
  mfaEnabledAt: Date | null;

  // SHA-256 hashes of single-use recovery codes, shown to the user once at
  // enable time. Each is removed from the array as it's consumed.
  @Column({ name: 'mfa_backup_codes', type: 'json', nullable: true })
  mfaBackupCodes: string[] | null;

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

  @Column({ name: 'reset_password_token', length: 100, nullable: true })
  resetPasswordToken: string;

  @Column({ name: 'reset_password_expires_at', nullable: true })
  resetPasswordExpiresAt: Date;

  @Column({ name: 'last_login_at', nullable: true })
  lastLoginAt: Date;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
