import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Onboarding SATUSEHAT (Template Registrasi Organization & Location):
 *  - satusehat_organizations: sub-organisasi fasyankes
 *  - locations: atribut Location SATUSEHAT (kode, tipe fisik, induk, alamat, koordinat, jam)
 *  - clinics.satusehat_profile: profil fasyankes (jenis, alamat + kode wilayah, kontak)
 * Idempotent — aman di setiap deploy (scripts/apply-security-schema.js).
 */
export class SatusehatOnboarding1790020000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('satusehat_organizations'))) {
      await queryRunner.query(`
        CREATE TABLE \`satusehat_organizations\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`parent_id\` INT NULL,
          \`code\` VARCHAR(50) NOT NULL,
          \`name\` VARCHAR(255) NOT NULL,
          \`type\` VARCHAR(20) NOT NULL DEFAULT 'dept',
          \`active\` TINYINT NOT NULL DEFAULT 1,
          \`phone\` VARCHAR(30) NULL,
          \`email\` VARCHAR(100) NULL,
          \`website\` VARCHAR(150) NULL,
          \`address\` JSON NULL,
          \`contact_name\` VARCHAR(150) NULL,
          \`contact_phone\` VARCHAR(30) NULL,
          \`contact_purpose\` VARCHAR(10) NULL,
          \`satusehat_id\` VARCHAR(100) NULL,
          \`sync_error\` VARCHAR(500) NULL,
          \`last_sync_at\` DATETIME NULL,
          \`created_by\` INT NULL,
          \`updated_by\` INT NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_satusehat_organizations_clinic\` (\`clinic_id\`),
          CONSTRAINT \`FK_satusehat_organizations_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }

    const columns: [string, string, string][] = [
      ['clinics', 'satusehat_profile', 'JSON NULL'],
      ['locations', 'ss_code', 'VARCHAR(50) NULL'],
      ['locations', 'ss_description', 'VARCHAR(255) NULL'],
      ['locations', 'ss_physical_type', 'VARCHAR(10) NULL'],
      ['locations', 'ss_parent_location_id', 'INT NULL'],
      ['locations', 'ss_organization_id', 'INT NULL'],
      ['locations', 'ss_phone', 'VARCHAR(30) NULL'],
      ['locations', 'ss_address', 'JSON NULL'],
      ['locations', 'ss_latitude', 'DECIMAL(10,7) NULL'],
      ['locations', 'ss_longitude', 'DECIMAL(10,7) NULL'],
      ['locations', 'ss_hours', 'JSON NULL'],
      ['locations', 'ss_sync_error', 'VARCHAR(500) NULL'],
    ];
    for (const [table, column, definition] of columns) {
      if (!(await queryRunner.hasColumn(table, column))) {
        await queryRunner.query(
          `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
        );
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `satusehat_organizations`');
    for (const column of [
      'ss_code',
      'ss_description',
      'ss_physical_type',
      'ss_parent_location_id',
      'ss_organization_id',
      'ss_phone',
      'ss_address',
      'ss_latitude',
      'ss_longitude',
      'ss_hours',
      'ss_sync_error',
    ]) {
      if (await queryRunner.hasColumn('locations', column)) {
        await queryRunner.query(
          `ALTER TABLE \`locations\` DROP COLUMN \`${column}\``,
        );
      }
    }
    if (await queryRunner.hasColumn('clinics', 'satusehat_profile')) {
      await queryRunner.query(
        'ALTER TABLE `clinics` DROP COLUMN `satusehat_profile`',
      );
    }
  }
}
