import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveLocationIdFromReservations1783300000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `reservations` DROP COLUMN `location_id`',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `reservations` ADD `location_id` INT NULL',
    );
  }
}
