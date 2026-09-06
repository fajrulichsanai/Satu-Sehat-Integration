import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePhysicalExaminations1787300000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`physical_examinations\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        \`encounter_id\` INT NOT NULL,

        \`general_condition\` VARCHAR(255) NULL,
        \`consciousness\` VARCHAR(255) NULL,

        \`blood_pressure_systolic\` INT NULL,
        \`blood_pressure_diastolic\` INT NULL,
        \`pulse_rate\` INT NULL,
        \`respiratory_rate\` INT NULL,
        \`temperature\` DECIMAL(4,1) NULL,
        \`oxygen_saturation\` INT NULL,

        \`cyanosis\` TEXT NULL,
        \`edema\` TEXT NULL,
        \`anemia\` TEXT NULL,
        \`jaundice\` TEXT NULL,

        \`skin\` TEXT NULL,
        \`lymph_nodes\` TEXT NULL,
        \`head\` TEXT NULL,
        \`hair\` TEXT NULL,
        \`eyes\` TEXT NULL,
        \`ears\` TEXT NULL,
        \`nose\` TEXT NULL,
        \`mouth\` TEXT NULL,
        \`neck\` TEXT NULL,

        \`lung_inspection\` TEXT NULL,
        \`lung_palpation\` TEXT NULL,
        \`lung_percussion\` TEXT NULL,
        \`lung_auscultation\` TEXT NULL,

        \`heart_inspection\` TEXT NULL,
        \`heart_palpation\` TEXT NULL,
        \`heart_percussion\` TEXT NULL,
        \`heart_auscultation\` TEXT NULL,

        \`abdomen_inspection\` TEXT NULL,
        \`abdomen_palpation\` TEXT NULL,
        \`abdomen_percussion\` TEXT NULL,
        \`abdomen_auscultation\` TEXT NULL,

        \`extremities\` TEXT NULL,
        \`genitalia\` TEXT NULL,
        \`rectal\` TEXT NULL,

        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_physical_examinations_encounter_id\` (\`encounter_id\`),
        CONSTRAINT \`FK_physical_examinations_encounter\` FOREIGN KEY (\`encounter_id\`)
          REFERENCES \`encounters\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `physical_examinations`');
  }
}
