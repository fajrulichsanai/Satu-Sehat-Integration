import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPainVitalsPrescriptions1787400000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`physical_examinations\`
        ADD COLUMN \`nutritional_status\` VARCHAR(255) NULL AFTER \`consciousness\`,
        ADD COLUMN \`height\` DECIMAL(5,1) NULL AFTER \`nutritional_status\`,
        ADD COLUMN \`weight\` DECIMAL(5,1) NULL AFTER \`height\`,
        ADD COLUMN \`pain_scale\` INT NULL AFTER \`weight\`,
        ADD COLUMN \`pain_points\` JSON NULL AFTER \`pain_scale\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`encounter_soap_notes\`
        ADD COLUMN \`treatment\` TEXT NULL AFTER \`assessment\`
    `);

    await queryRunner.query(`
      CREATE TABLE \`prescription_items\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        \`encounter_id\` INT NOT NULL,
        \`drug_name\` VARCHAR(255) NOT NULL,
        \`dosage\` VARCHAR(100) NULL,
        \`frequency\` VARCHAR(100) NULL,
        \`duration\` VARCHAR(100) NULL,
        \`quantity\` VARCHAR(100) NULL,
        \`instructions\` TEXT NULL,
        \`sort_order\` INT NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_prescription_items_encounter_id\` (\`encounter_id\`),
        CONSTRAINT \`FK_prescription_items_encounter\` FOREIGN KEY (\`encounter_id\`)
          REFERENCES \`encounters\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `prescription_items`');
    await queryRunner.query(
      'ALTER TABLE `encounter_soap_notes` DROP COLUMN `treatment`',
    );
    await queryRunner.query(`
      ALTER TABLE \`physical_examinations\`
        DROP COLUMN \`nutritional_status\`,
        DROP COLUMN \`height\`,
        DROP COLUMN \`weight\`,
        DROP COLUMN \`pain_scale\`,
        DROP COLUMN \`pain_points\`
    `);
  }
}
