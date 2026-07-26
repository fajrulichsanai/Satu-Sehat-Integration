import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdditionalFeeToBillings1783500000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `billings` ADD `additional_fee` DECIMAL(10,2) NOT NULL DEFAULT 0',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `billings` DROP COLUMN `additional_fee`',
    );
  }
}
