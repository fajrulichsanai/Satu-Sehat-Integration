import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Fitur custom dihapus total: tabel `custom_features` beserta pengaturan
 *   `custom:*` di clinic_features / user_features
 * - Tabel `platform_settings` untuk saklar global super admin (mis. SATUSEHAT).
 *   Tanpa baris = SATUSEHAT mati di seluruh klinik.
 * Idempotent (scripts/apply-security-schema.js).
 */
export class HapusFiturCustomPengaturanPlatform1790130000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('clinic_features')) {
      await queryRunner.query(
        "DELETE FROM `clinic_features` WHERE `feature_key` LIKE 'custom:%'",
      );
    }
    if (await queryRunner.hasTable('user_features')) {
      await queryRunner.query(
        "DELETE FROM `user_features` WHERE `feature_key` LIKE 'custom:%'",
      );
    }
    await queryRunner.query('DROP TABLE IF EXISTS `custom_features`');

    if (!(await queryRunner.hasTable('platform_settings'))) {
      await queryRunner.query(`
        CREATE TABLE \`platform_settings\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`setting_key\` VARCHAR(60) NOT NULL,
          \`value\` VARCHAR(500) NOT NULL,
          \`created_by\` INT NULL,
          \`updated_by\` INT NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`UQ_platform_settings_key\` (\`setting_key\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `platform_settings`');
    // Fitur custom tidak dibuat ulang: datanya sudah dihapus
  }
}
