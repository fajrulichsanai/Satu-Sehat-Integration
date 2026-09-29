import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  encryptNik,
  decryptNik,
  hashNik,
} from '../../common/utils/nik-crypto.util';

// A value already in `<32-hex-iv>:<hex-ciphertext>` shape was almost
// certainly already encrypted by this migration (or a prior partial run of
// it) — a real 16-digit NIK can never match this pattern, so it's a safe
// marker to make the migration idempotent/resumable.
const ALREADY_ENCRYPTED = /^[0-9a-f]{32}:[0-9a-f]+$/i;

interface PractitionerNikRow {
  id: number;
  nik: string | null;
}

/**
 * Encrypts `practitioners.nik` at rest and replaces the plaintext-based
 * (nik, clinic_id) unique index with one over a new `nik_hash` blind-index
 * column — same treatment as patients.nik (see EncryptPatientNik), for the
 * same reason: the encrypted column can no longer support the equality
 * lookup PractitionersService.create() uses for its duplicate check.
 *
 * Requires PATIENT_DATA_ENCRYPTION_KEY to be set wherever this migration
 * runs — it throws immediately (via nik-crypto.util) if it isn't.
 */
export class EncryptPractitionerNik1789600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const oldIndexes: Array<{ INDEX_NAME: string }> = await queryRunner.query(
      `SELECT DISTINCT INDEX_NAME
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'practitioners'
         AND COLUMN_NAME = 'nik'
         AND INDEX_NAME != 'PRIMARY'`,
    );
    for (const { INDEX_NAME } of oldIndexes) {
      await queryRunner.query(
        `ALTER TABLE \`practitioners\` DROP INDEX \`${INDEX_NAME}\``,
      );
    }

    await queryRunner.query(
      `ALTER TABLE \`practitioners\`
         MODIFY COLUMN \`nik\` VARCHAR(255) NULL,
         ADD COLUMN \`nik_hash\` VARCHAR(64) NULL AFTER \`nik\``,
    );

    const rows: PractitionerNikRow[] = await queryRunner.query(
      'SELECT id, nik FROM practitioners WHERE nik IS NOT NULL',
    );

    for (const row of rows) {
      if (!row.nik || ALREADY_ENCRYPTED.test(row.nik)) continue;
      await queryRunner.query(
        'UPDATE practitioners SET nik = ?, nik_hash = ? WHERE id = ?',
        [encryptNik(row.nik), hashNik(row.nik), row.id],
      );
    }

    await queryRunner.query(
      'ALTER TABLE `practitioners` ADD UNIQUE INDEX `IDX_practitioners_nik_hash_clinic` (`nik_hash`, `clinic_id`)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `practitioners` DROP INDEX `IDX_practitioners_nik_hash_clinic`',
    );

    const rows: PractitionerNikRow[] = await queryRunner.query(
      'SELECT id, nik FROM practitioners WHERE nik IS NOT NULL',
    );

    for (const row of rows) {
      if (!row.nik || !ALREADY_ENCRYPTED.test(row.nik)) continue;
      await queryRunner.query('UPDATE practitioners SET nik = ? WHERE id = ?', [
        decryptNik(row.nik),
        row.id,
      ]);
    }

    await queryRunner.query(
      `ALTER TABLE \`practitioners\`
         DROP COLUMN \`nik_hash\`,
         MODIFY COLUMN \`nik\` VARCHAR(16) NULL`,
    );

    await queryRunner.query(
      'ALTER TABLE `practitioners` ADD UNIQUE INDEX `IDX_practitioners_nik_clinic` (`nik`, `clinic_id`)',
    );
  }
}
