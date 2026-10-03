import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSignatureToEncounterSoapNotes1787100000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`encounter_soap_notes\`
      ADD COLUMN \`signature\` MEDIUMTEXT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `encounter_soap_notes` DROP COLUMN `signature`',
    );
  }
}
