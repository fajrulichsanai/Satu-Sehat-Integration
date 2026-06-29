import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeskripsiToTarifs1719446400000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `tarifs` ADD `deskripsi` TEXT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `tarifs` DROP COLUMN `deskripsi`');
  }
}
