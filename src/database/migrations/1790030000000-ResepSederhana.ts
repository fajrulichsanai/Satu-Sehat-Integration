import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Resep sederhana: sediaan, numero, aturan pakai (signa) terstruktur, dan
 * tanda tangan dokter per resep. Idempotent (scripts/apply-security-schema.js).
 */
export class ResepSederhana1790030000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const columns: [string, string][] = [
      ['dosage_form', 'VARCHAR(100) NULL'],
      ['numero', 'INT NULL'],
      ['signa', 'JSON NULL'],
    ];
    for (const [column, definition] of columns) {
      if (!(await queryRunner.hasColumn('prescription_items', column))) {
        await queryRunner.query(
          `ALTER TABLE \`prescription_items\` ADD COLUMN \`${column}\` ${definition}`,
        );
      }
    }

    if (!(await queryRunner.hasTable('prescription_signatures'))) {
      await queryRunner.query(`
        CREATE TABLE \`prescription_signatures\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`encounter_id\` INT NOT NULL,
          \`signature\` MEDIUMTEXT NOT NULL,
          \`signed_at\` DATETIME NOT NULL,
          \`created_by\` INT NULL,
          \`updated_by\` INT NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`UQ_prescription_signatures_encounter\` (\`encounter_id\`),
          CONSTRAINT \`FK_prescription_signatures_encounter\` FOREIGN KEY (\`encounter_id\`) REFERENCES \`encounters\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `prescription_signatures`');
    for (const column of ['dosage_form', 'numero', 'signa']) {
      if (await queryRunner.hasColumn('prescription_items', column)) {
        await queryRunner.query(
          `ALTER TABLE \`prescription_items\` DROP COLUMN \`${column}\``,
        );
      }
    }
  }
}
