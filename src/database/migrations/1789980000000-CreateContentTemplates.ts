import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Konten templates: one per treatment (Tambal, Cabut, Scaling, …) holding
 * the story text and look, so each new story only needs its photos. A story
 * remembers its template, which groups the gallery by treatment.
 * Idempotent — safe on every deploy (scripts/apply-security-schema.js).
 */
export class CreateContentTemplates1789980000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('content_templates'))) {
      await queryRunner.query(`
        CREATE TABLE \`content_templates\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`name\` VARCHAR(40) NOT NULL,
          \`title\` VARCHAR(64) NOT NULL,
          \`layout\` ENUM('stack', 'split') NOT NULL DEFAULT 'stack',
          \`background\` ENUM('light', 'navy') NOT NULL DEFAULT 'light',
          \`show_disclaimer\` TINYINT(1) NOT NULL DEFAULT 1,
          \`settings\` JSON NULL,
          \`created_by\` INT NULL,
          \`updated_by\` INT NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_content_templates_clinic\` (\`clinic_id\`),
          CONSTRAINT \`FK_content_templates_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }
    if (!(await queryRunner.hasColumn('clinic_contents', 'template_id'))) {
      await queryRunner.query(`
        ALTER TABLE \`clinic_contents\`
          ADD COLUMN \`template_id\` INT NULL AFTER \`clinic_id\`,
          ADD INDEX \`IDX_clinic_contents_template\` (\`template_id\`),
          ADD CONSTRAINT \`FK_clinic_contents_template\` FOREIGN KEY (\`template_id\`) REFERENCES \`content_templates\` (\`id\`) ON DELETE SET NULL
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('clinic_contents', 'template_id')) {
      await queryRunner.query(
        'ALTER TABLE `clinic_contents` DROP FOREIGN KEY `FK_clinic_contents_template`',
      );
      await queryRunner.query(
        'ALTER TABLE `clinic_contents` DROP COLUMN `template_id`',
      );
    }
    await queryRunner.query('DROP TABLE IF EXISTS `content_templates`');
  }
}
