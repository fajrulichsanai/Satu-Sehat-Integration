import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDentalExaminationAndSupportingExamImages1787700000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`dental_examinations\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        \`encounter_id\` INT NOT NULL,
        \`ohis_debris\` DECIMAL(3,1) NULL,
        \`ohis_calculus\` DECIMAL(3,1) NULL,
        \`gingival_index\` DECIMAL(3,1) NULL,
        \`plaque_surfaces_with_plaque\` INT NULL,
        \`plaque_surfaces_examined\` INT NULL,
        \`probing_depths\` JSON NULL,
        \`notes\` TEXT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_dental_examinations_encounter_id\` (\`encounter_id\`),
        CONSTRAINT \`FK_dental_examinations_encounter\` FOREIGN KEY (\`encounter_id\`)
          REFERENCES \`encounters\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE \`supporting_exam_images\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        \`encounter_id\` INT NOT NULL,
        \`image_type\` ENUM('photo', 'xray') NOT NULL DEFAULT 'photo',
        \`file_url\` VARCHAR(255) NOT NULL,
        \`original_name\` VARCHAR(255) NULL,
        \`notes\` TEXT NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_supporting_exam_images_encounter_id\` (\`encounter_id\`),
        CONSTRAINT \`FK_supporting_exam_images_encounter\` FOREIGN KEY (\`encounter_id\`)
          REFERENCES \`encounters\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `supporting_exam_images`');
    await queryRunner.query('DROP TABLE `dental_examinations`');
  }
}
