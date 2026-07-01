import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRiwayatPenyakitToPatients1782900000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `patients` ADD `riwayat_hipertensi` TINYINT NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `patients` ADD `riwayat_diabetes` TINYINT NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `patients` ADD `riwayat_paru_paru` TINYINT NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `patients` ADD `riwayat_syaraf` TINYINT NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `patients` ADD `riwayat_sistemik_lainnya` TINYINT NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `patients` ADD `alergi_obat` TINYINT NOT NULL DEFAULT 0',
    );
    await queryRunner.query(
      'ALTER TABLE `patients` ADD `alergi_makanan` TINYINT NOT NULL DEFAULT 0',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `alergi_makanan`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `alergi_obat`');
    await queryRunner.query(
      'ALTER TABLE `patients` DROP COLUMN `riwayat_sistemik_lainnya`',
    );
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `riwayat_syaraf`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `riwayat_paru_paru`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `riwayat_diabetes`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `riwayat_hipertensi`');
  }
}
