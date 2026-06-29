import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContactColumnsToPractitioners1719360000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `practitioners` ADD `phone` VARCHAR(20) NULL'
    );
    await queryRunner.query(
      'ALTER TABLE `practitioners` ADD `email` VARCHAR(100) NULL'
    );
    await queryRunner.query(
      'ALTER TABLE `practitioners` ADD `sip_number` VARCHAR(50) NULL'
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `practitioners` DROP COLUMN `sip_number`');
    await queryRunner.query('ALTER TABLE `practitioners` DROP COLUMN `email`');
    await queryRunner.query('ALTER TABLE `practitioners` DROP COLUMN `phone`');
  }
}
