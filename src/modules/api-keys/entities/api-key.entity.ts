import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum ApiKeyType {
  /** For websites: read-only public data + reservations, locked to allowed origins. */
  PUBLISHABLE = 'publishable',
  /** For a clinic's own servers: same scope, but never usable from a browser. */
  SECRET = 'secret',
}

/**
 * A clinic's key for the public API (/v1). Only a SHA-256 hash of the key is
 * stored; the plaintext is shown once, at creation/rotation.
 */
@Entity('api_keys')
@Index(['clinicId'])
export class ApiKey {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clinic_id', type: 'int' })
  clinicId: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: ApiKeyType })
  type: ApiKeyType;

  /** First characters of the key (e.g. "apx_pk_Ab3d"), for recognising it in the UI. */
  @Column({ name: 'key_prefix', type: 'varchar', length: 20 })
  keyPrefix: string;

  @Index({ unique: true })
  @Column({ name: 'key_hash', type: 'char', length: 64 })
  keyHash: string;

  /** Origins (scheme://host[:port]) a publishable key may be used from. */
  @Column({ name: 'allowed_origins', type: 'json', nullable: true })
  allowedOrigins: string[] | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy: number | null;

  @Column({ name: 'last_used_at', type: 'datetime', nullable: true })
  lastUsedAt: Date | null;

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
