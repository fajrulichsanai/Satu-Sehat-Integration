import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Konten: before–after stories a clinic designs and publishes to its website.
 * Idempotent — safe on every deploy (scripts/apply-security-schema.js).
 */
export class CreateClinicContents1789970000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('clinic_contents')) return;
    await queryRunner.query(`
      CREATE TABLE \`clinic_contents\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`clinic_id\` INT NOT NULL,
        \`title\` VARCHAR(64) NOT NULL,
        \`caption\` VARCHAR(120) NULL,
        \`layout\` ENUM('stack', 'split') NOT NULL DEFAULT 'stack',
        \`background\` ENUM('light', 'navy') NOT NULL DEFAULT 'light',
        \`show_disclaimer\` TINYINT(1) NOT NULL DEFAULT 1,
        \`before_image_url\` VARCHAR(500) NULL,
        \`after_image_url\` VARCHAR(500) NULL,
        \`settings\` JSON NULL,
        \`image_url\` VARCHAR(500) NULL,
        \`status\` ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
        \`published_at\` DATETIME NULL,
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_clinic_contents_clinic_status\` (\`clinic_id\`, \`status\`),
        CONSTRAINT \`FK_clinic_contents_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `clinic_contents`');
  }
}
