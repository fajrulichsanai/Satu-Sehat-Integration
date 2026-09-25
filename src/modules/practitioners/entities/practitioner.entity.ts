import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/base.entity';
import { Gender } from '../../../enums';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { nikColumnTransformer } from '../../../common/utils/nik-crypto.util';

@Entity('practitioners')
@Index(['nikHash', 'clinicId'], { unique: true })
export class Practitioner extends BaseEntity {
  @Column({ name: 'clinic_id' })
  clinicId: number;

  @Column({ name: 'user_id', nullable: true })
  userId: number;

  // Encrypted at rest (see nik-crypto.util) — never queried directly by
  // value. Widened to fit ciphertext (iv:hex), which is longer than the
  // plaintext 16-digit NIK.
  @Column({ length: 255, nullable: true, transformer: nikColumnTransformer })
  nik: string;

  // Deterministic HMAC of `nik`, maintained by PractitionersService
  // alongside every write to `nik`. This — not `nik` — is what the
  // duplicate check queries against, since the encrypted column can't
  // support equality lookups.
  @Column({ name: 'nik_hash', type: 'varchar', length: 64, nullable: true })
  nikHash: string | null;

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

  @Column({ name: 'str_number', length: 50, nullable: true })
  strNumber: string;

  @Column({ name: 'satusehat_practitioner_id', length: 100, nullable: true })
  satusehatPractitionerId: string;

  /** Public profile photo (clinic website / public API). */
  @Column({ name: 'photo_url', type: 'varchar', length: 500, nullable: true })
  photoUrl: string | null;

  /** Practice hours by day, same shape as Clinic.operationalHours
   * ({ senin: '08:00-14:00', minggu: 'Tutup', ... }). Null = follows the clinic's hours. */
  @Column({ name: 'jadwal_praktik', type: 'json', nullable: true })
  jadwalPraktik: Record<string, string> | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  // Relations
  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic: Clinic;
}
