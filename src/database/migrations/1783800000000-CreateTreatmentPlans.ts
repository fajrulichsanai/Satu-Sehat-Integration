import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTreatmentPlans1783800000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`treatment_plans\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        \`clinic_id\` INT NOT NULL,
        \`patient_id\` INT NOT NULL,
        \`treatment_type\` ENUM('orthodontic', 'root_canal', 'other') NOT NULL DEFAULT 'other',
        \`label\` VARCHAR(150) NULL,
        \`total_stages\` INT NULL,
        \`current_stage\` INT NOT NULL DEFAULT 0,
        \`status\` ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
        \`start_date\` DATE NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_treatment_plans_patient_id\` (\`patient_id\`),
        INDEX \`IDX_treatment_plans_clinic_id\` (\`clinic_id\`),
        CONSTRAINT \`FK_treatment_plans_clinic\` FOREIGN KEY (\`clinic_id\`)
          REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_treatment_plans_patient\` FOREIGN KEY (\`patient_id\`)
          REFERENCES \`patients\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE \`treatment_plan_sessions\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        \`treatment_plan_id\` INT NOT NULL,
        \`stage_number\` INT NOT NULL,
        \`encounter_id\` INT NULL,
        \`date\` DATE NOT NULL,
        \`notes\` TEXT NULL,
        \`status\` ENUM('scheduled', 'completed', 'missed') NOT NULL DEFAULT 'completed',
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_treatment_plan_sessions_plan_id\` (\`treatment_plan_id\`),
        CONSTRAINT \`FK_treatment_plan_sessions_plan\` FOREIGN KEY (\`treatment_plan_id\`)
          REFERENCES \`treatment_plans\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_treatment_plan_sessions_encounter\` FOREIGN KEY (\`encounter_id\`)
          REFERENCES \`encounters\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `treatment_plan_sessions`');
    await queryRunner.query('DROP TABLE `treatment_plans`');
  }
}
