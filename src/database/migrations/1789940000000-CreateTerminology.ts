import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Diagnosis terminology (ICD-10, SNOMED CT) for the SOAP assessment, plus
 * the structured diagnoses on each SOAP note. Idempotent — safe after
 * DB_SYNCHRONIZE and on every deploy (scripts/apply-security-schema.js).
 * The rows themselves are loaded by scripts/seed-terminology.js.
 */
export class CreateTerminology1789940000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('terminology_concepts'))) {
      await queryRunner.query(`
        CREATE TABLE \`terminology_concepts\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`system\` VARCHAR(10) NOT NULL,
          \`code\` VARCHAR(20) NOT NULL,
          \`display\` VARCHAR(255) NOT NULL,
          \`aliases\` TEXT NULL,
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`IDX_terminology_system_code\` (\`system\`, \`code\`),
          FULLTEXT INDEX \`FT_terminology_text\` (\`display\`, \`aliases\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } else {
      // Created by DB_SYNCHRONIZE on an older build? Make sure search works.
      const ft = await queryRunner.query(
        "SHOW INDEX FROM `terminology_concepts` WHERE Key_name = 'FT_terminology_text'",
      );
      if (!ft.length) {
        await queryRunner.query(
          'ALTER TABLE `terminology_concepts` ADD FULLTEXT INDEX `FT_terminology_text` (`display`, `aliases`)',
        );
      }
    }
    if (!(await queryRunner.hasTable('terminology_meta'))) {
      await queryRunner.query(`
        CREATE TABLE \`terminology_meta\` (
          \`system\` VARCHAR(10) NOT NULL,
          \`version\` VARCHAR(64) NOT NULL,
          \`count\` INT NOT NULL,
          \`loaded_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`system\`)
        ) ENGINE=InnoDB
      `);
    }
    if (!(await queryRunner.hasColumn('encounter_soap_notes', 'diagnoses'))) {
      await queryRunner.query(
        'ALTER TABLE `encounter_soap_notes` ADD COLUMN `diagnoses` JSON NULL',
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('encounter_soap_notes', 'diagnoses')) {
      await queryRunner.query(
        'ALTER TABLE `encounter_soap_notes` DROP COLUMN `diagnoses`',
      );
    }
    await queryRunner.query('DROP TABLE IF EXISTS `terminology_meta`');
    await queryRunner.query('DROP TABLE IF EXISTS `terminology_concepts`');
  }
}
