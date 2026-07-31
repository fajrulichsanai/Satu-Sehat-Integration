import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCatatanSistemikLainnyaToPatients1783600000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `patients` ADD `catatan_sistemik_lainnya` TEXT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `patients` DROP COLUMN `catatan_sistemik_lainnya`',
    );
  }
}
