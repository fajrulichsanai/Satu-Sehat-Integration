import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOdontogram1787600000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`tooth_conditions\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        \`patient_id\` INT NOT NULL,
        \`tooth_number\` INT NOT NULL,
        \`whole_condition\` VARCHAR(30) NULL,
        \`surface_mesial\` VARCHAR(20) NULL,
        \`surface_distal\` VARCHAR(20) NULL,
        \`surface_vestibular\` VARCHAR(20) NULL,
        \`surface_lingual\` VARCHAR(20) NULL,
        \`surface_occlusal\` VARCHAR(20) NULL,
        \`notes\` TEXT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_tooth_conditions_patient_tooth\` (\`patient_id\`, \`tooth_number\`),
        CONSTRAINT \`FK_tooth_conditions_patient\` FOREIGN KEY (\`patient_id\`)
          REFERENCES \`patients\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE \`dental_bridges\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        \`patient_id\` INT NOT NULL,
        \`from_tooth\` INT NOT NULL,
        \`to_tooth\` INT NOT NULL,
        \`label\` VARCHAR(100) NOT NULL DEFAULT 'Gigi Tiruan Cekat',
        \`notes\` TEXT NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_dental_bridges_patient_id\` (\`patient_id\`),
        CONSTRAINT \`FK_dental_bridges_patient\` FOREIGN KEY (\`patient_id\`)
          REFERENCES \`patients\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `dental_bridges`');
    await queryRunner.query('DROP TABLE `tooth_conditions`');
  }
}
