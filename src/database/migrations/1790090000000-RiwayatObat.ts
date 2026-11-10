import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Riwayat pengobatan pasien (→ MedicationStatement SATUSEHAT).
 * Idempotent (scripts/apply-security-schema.js).
 */
export class RiwayatObat1790090000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('patients', 'riwayat_obat'))) {
      await queryRunner.query(
        'ALTER TABLE `patients` ADD `riwayat_obat` JSON NULL',
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('patients', 'riwayat_obat')) {
      await queryRunner.query(
        'ALTER TABLE `patients` DROP COLUMN `riwayat_obat`',
      );
    }
  }
}
