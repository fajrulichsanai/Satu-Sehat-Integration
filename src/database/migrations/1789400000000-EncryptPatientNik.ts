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

interface PatientNikRow {
  id: number;
  nik: string | null;
  nik_ibu: string | null;
}

/**
 * Encrypts `patients.nik` / `patients.nik_ibu` at rest and replaces the
 * plaintext-based `(nik, clinic_id)` unique index with one over a new
 * `nik_hash` blind-index column, since the encrypted column can no longer
 * support equality lookups (see nik-crypto.util for why).
 *
 * Requires PATIENT_DATA_ENCRYPTION_KEY to be set wherever this migration
 * runs — it throws immediately (via nik-crypto.util) if it isn't.
 */
export class EncryptPatientNik1789400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const oldIndexes: Array<{ INDEX_NAME: string }> = await queryRunner.query(
      `SELECT DISTINCT INDEX_NAME
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'patients'
         AND COLUMN_NAME = 'nik'
         AND INDEX_NAME != 'PRIMARY'`,
    );
    for (const { INDEX_NAME } of oldIndexes) {
      await queryRunner.query(
        `ALTER TABLE \`patients\` DROP INDEX \`${INDEX_NAME}\``,
      );
    }

    await queryRunner.query(
      `ALTER TABLE \`patients\`
         MODIFY COLUMN \`nik\` VARCHAR(255) NULL,
         MODIFY COLUMN \`nik_ibu\` VARCHAR(255) NULL,
         ADD COLUMN \`nik_hash\` VARCHAR(64) NULL AFTER \`nik\``,
    );

    const rows: PatientNikRow[] = await queryRunner.query(
      'SELECT id, nik, nik_ibu FROM patients WHERE nik IS NOT NULL OR nik_ibu IS NOT NULL',
    );

    for (const row of rows) {
      const nikPlain =
        row.nik && !ALREADY_ENCRYPTED.test(row.nik) ? row.nik : null;
      const nikIbuPlain =
        row.nik_ibu && !ALREADY_ENCRYPTED.test(row.nik_ibu)
          ? row.nik_ibu
          : null;

      if (nikPlain === null && nikIbuPlain === null) continue;

      const nikEncrypted = nikPlain ? encryptNik(nikPlain) : row.nik;
      const nikHash = nikPlain ? hashNik(nikPlain) : undefined;
      const nikIbuEncrypted = nikIbuPlain
        ? encryptNik(nikIbuPlain)
        : row.nik_ibu;

      if (nikHash !== undefined) {
        await queryRunner.query(
          'UPDATE patients SET nik = ?, nik_hash = ?, nik_ibu = ? WHERE id = ?',
          [nikEncrypted, nikHash, nikIbuEncrypted, row.id],
        );
      } else {
        await queryRunner.query(
          'UPDATE patients SET nik_ibu = ? WHERE id = ?',
          [nikIbuEncrypted, row.id],
        );
      }
    }

    await queryRunner.query(
      'ALTER TABLE `patients` ADD UNIQUE INDEX `IDX_patients_nik_hash_clinic` (`nik_hash`, `clinic_id`)',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `patients` DROP INDEX `IDX_patients_nik_hash_clinic`',
    );

    const rows: PatientNikRow[] = await queryRunner.query(
      'SELECT id, nik, nik_ibu FROM patients WHERE nik IS NOT NULL OR nik_ibu IS NOT NULL',
    );

    for (const row of rows) {
      const nikDecrypted =
        row.nik && ALREADY_ENCRYPTED.test(row.nik)
          ? decryptNik(row.nik)
          : row.nik;
      const nikIbuDecrypted =
        row.nik_ibu && ALREADY_ENCRYPTED.test(row.nik_ibu)
          ? decryptNik(row.nik_ibu)
          : row.nik_ibu;

      await queryRunner.query(
        'UPDATE patients SET nik = ?, nik_ibu = ? WHERE id = ?',
        [nikDecrypted, nikIbuDecrypted, row.id],
      );
    }

    await queryRunner.query(
      `ALTER TABLE \`patients\`
         DROP COLUMN \`nik_hash\`,
         MODIFY COLUMN \`nik\` VARCHAR(16) NULL,
         MODIFY COLUMN \`nik_ibu\` VARCHAR(16) NULL`,
    );

    await queryRunner.query(
      'ALTER TABLE `patients` ADD UNIQUE INDEX `IDX_patients_nik_clinic` (`nik`, `clinic_id`)',
    );
  }
}
