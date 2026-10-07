import { MigrationInterface, QueryRunner } from 'typeorm';

/** Imunisasi/vaksin per kunjungan (→ Immunization SATUSEHAT). Idempoten. */
export class Imunisasi1790080000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('immunizations')) return;
    await queryRunner.query(`
      CREATE TABLE \`immunizations\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`clinic_id\` INT NOT NULL,
        \`encounter_id\` INT NOT NULL,
        \`patient_id\` INT NOT NULL,
        \`kfa_code\` VARCHAR(20) NOT NULL,
        \`vaccine_name\` VARCHAR(255) NOT NULL,
        \`dose_number\` INT NOT NULL,
        \`dose_ml\` DECIMAL(5,2) NULL,
        \`route\` VARCHAR(30) NULL,
        \`site\` VARCHAR(4) NULL,
        \`lot_number\` VARCHAR(50) NULL,
        \`expiration_date\` DATE NULL,
        \`occurred_at\` DATETIME NOT NULL,
        \`note\` VARCHAR(300) NULL,
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'completed',
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_immunizations_encounter\` (\`encounter_id\`),
        INDEX \`IDX_immunizations_patient\` (\`clinic_id\`, \`patient_id\`),
        CONSTRAINT \`FK_immunizations_encounter\` FOREIGN KEY (\`encounter_id\`) REFERENCES \`encounters\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_immunizations_patient\` FOREIGN KEY (\`patient_id\`) REFERENCES \`patients\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `immunizations`');
  }
}
