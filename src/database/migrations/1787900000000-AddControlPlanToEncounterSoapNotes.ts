import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddControlPlanToEncounterSoapNotes1787900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`encounter_soap_notes\`
      ADD COLUMN \`control_plan\` TEXT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `encounter_soap_notes` DROP COLUMN `control_plan`',
    );
  }
}
