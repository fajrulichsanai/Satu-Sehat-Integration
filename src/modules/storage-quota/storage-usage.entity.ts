import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Jenis file layanan yang dihitung ke jatah storage klinik. */
export enum StorageKind {
  /** Foto pemeriksaan penunjang (rontgen, foto intraoral, dll.). */
  SUPPORTING_EXAM = 'supporting-exam',
  /** Foto untuk konten media sosial klinik. */
  CONTENT = 'content',
  /** Foto klinis per pasien/kontrol (folder & template foto klinis). */
  PATIENT_PHOTO = 'patient-photo',
}

/**
 * Satu baris per file layanan yang tersimpan, dengan ukurannya. Jumlah per
 * klinik = pemakaian storage klinik itu. Logo, foto profil, bukti transfer,
 * dan file impor tidak dihitung (PRD: hanya file layanan).
 */
@Entity('storage_usage')
@Index('UQ_storage_usage_kind_ref', ['kind', 'ref'], { unique: true })
export class StorageUsage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_id' })
  @Index('IDX_storage_usage_clinic')
  clinicId: number;

  @Column({ type: 'varchar', length: 30 })
  kind: StorageKind;

  /** The stored file's URL/path as kept on the owning row. */
  @Column({ type: 'varchar', length: 500 })
  ref: string;

  // BIGINT comes back from MySQL as a string; normalised in the service.
  @Column({ type: 'bigint', default: 0 })
  bytes: string | number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
