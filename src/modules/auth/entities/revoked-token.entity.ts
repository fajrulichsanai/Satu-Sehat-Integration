import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Denylist of individual access tokens ended by logout or refresh. Rows only
 * need to live until the token would have expired anyway, so a daily job
 * (AuthService.purgeExpiredRevokedTokens) deletes them after `expires_at`.
 */
@Entity('revoked_tokens')
export class RevokedToken {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  jti: string;

  @Index()
  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
