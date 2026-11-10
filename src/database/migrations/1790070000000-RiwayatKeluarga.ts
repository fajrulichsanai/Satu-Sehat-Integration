import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Riwayat penyakit keluarga pasien (→ FamilyMemberHistory SATUSEHAT).
 * Idempotent (scripts/apply-security-schema.js).
 */
export class RiwayatKeluarga1790070000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('patients', 'riwayat_keluarga'))) {
      await queryRunner.query(
        'ALTER TABLE `patients` ADD `riwayat_keluarga` JSON NULL',
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('patients', 'riwayat_keluarga')) {
      await queryRunner.query(
        'ALTER TABLE `patients` DROP COLUMN `riwayat_keluarga`',
      );
    }
  }
}
