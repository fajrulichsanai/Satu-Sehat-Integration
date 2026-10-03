import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddStrNumberToPractitioners1787500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`practitioners\`
        ADD COLUMN \`str_number\` VARCHAR(50) NULL AFTER \`sip_number\`
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `practitioners` DROP COLUMN `str_number`',
    );
  }
}
