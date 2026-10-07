import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Modul Kondisi (daftar masalah pasien → FHIR Condition) dan Observasi
 * tambahan (→ FHIR Observation). Idempotent (scripts/apply-security-schema.js).
 */
export class KondisiDanObservasi1790050000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const common = `
      \`sync_status\` VARCHAR(10) NOT NULL DEFAULT 'pending',
      \`sync_error\` VARCHAR(500) NULL,
      \`satusehat_id\` VARCHAR(100) NULL,
      \`last_sync_at\` DATETIME NULL,
      \`created_by\` INT NULL,
      \`updated_by\` INT NULL,
      \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`;

    if (!(await queryRunner.hasTable('patient_conditions'))) {
      await queryRunner.query(`
        CREATE TABLE \`patient_conditions\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`patient_id\` INT NOT NULL,
          \`encounter_id\` INT NOT NULL,
          \`last_encounter_id\` INT NOT NULL,
          \`code_system\` VARCHAR(10) NOT NULL,
          \`code\` VARCHAR(30) NOT NULL,
          \`display\` VARCHAR(255) NOT NULL,
          \`name_id\` VARCHAR(255) NULL,
          \`clinical_status\` VARCHAR(20) NOT NULL,
          \`verification_status\` VARCHAR(20) NOT NULL,
          \`severity\` VARCHAR(10) NULL,
          \`onset_date\` DATE NULL,
          \`abatement_date\` DATE NULL,
          \`note\` VARCHAR(500) NULL,
          ${common},
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_patient_conditions_patient\` (\`clinic_id\`, \`patient_id\`),
          INDEX \`IDX_patient_conditions_last_enc\` (\`last_encounter_id\`),
          CONSTRAINT \`FK_patient_conditions_patient\` FOREIGN KEY (\`patient_id\`) REFERENCES \`patients\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`FK_patient_conditions_encounter\` FOREIGN KEY (\`encounter_id\`) REFERENCES \`encounters\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }

    if (!(await queryRunner.hasTable('clinical_observations'))) {
      await queryRunner.query(`
        CREATE TABLE \`clinical_observations\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`patient_id\` INT NOT NULL,
          \`encounter_id\` INT NOT NULL,
          \`observation_key\` VARCHAR(40) NOT NULL,
          \`value_number\` DECIMAL(10,2) NULL,
          \`value_code\` VARCHAR(30) NULL,
          \`effective_at\` DATETIME NOT NULL,
          \`note\` VARCHAR(500) NULL,
          \`status\` VARCHAR(20) NOT NULL DEFAULT 'final',
          ${common},
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_clinical_observations_patient\` (\`clinic_id\`, \`patient_id\`),
          INDEX \`IDX_clinical_observations_encounter\` (\`encounter_id\`),
          CONSTRAINT \`FK_clinical_observations_patient\` FOREIGN KEY (\`patient_id\`) REFERENCES \`patients\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`FK_clinical_observations_encounter\` FOREIGN KEY (\`encounter_id\`) REFERENCES \`encounters\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `clinical_observations`');
    await queryRunner.query('DROP TABLE IF EXISTS `patient_conditions`');
  }
}
