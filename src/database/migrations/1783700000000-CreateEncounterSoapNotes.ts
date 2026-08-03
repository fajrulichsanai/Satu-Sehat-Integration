import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEncounterSoapNotes1783700000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`encounter_soap_notes\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        \`encounter_id\` INT NOT NULL,
        \`subjective\` TEXT NULL,
        \`objective\` TEXT NULL,
        \`assessment\` TEXT NULL,
        \`plan\` TEXT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_encounter_soap_notes_encounter_id\` (\`encounter_id\`),
        CONSTRAINT \`FK_encounter_soap_notes_encounter\` FOREIGN KEY (\`encounter_id\`)
          REFERENCES \`encounters\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `encounter_soap_notes`');
  }
}
