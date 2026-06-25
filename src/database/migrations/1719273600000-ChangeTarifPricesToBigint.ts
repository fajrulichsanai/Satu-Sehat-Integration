import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeTarifPricesToBigint1719273600000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `tarifs` MODIFY `harga_pokok` BIGINT NOT NULL DEFAULT 0'
    );
    await queryRunner.query(
      'ALTER TABLE `tarifs` MODIFY `harga_jual` BIGINT NOT NULL'
    );
    await queryRunner.query(
      'ALTER TABLE `tarifs` MODIFY `diskon_maksimal` BIGINT NOT NULL DEFAULT 0'
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `tarifs` MODIFY `diskon_maksimal` DECIMAL(10,2) NOT NULL DEFAULT 0'
    );
    await queryRunner.query(
      'ALTER TABLE `tarifs` MODIFY `harga_jual` DECIMAL(10,2) NOT NULL'
    );
    await queryRunner.query(
      'ALTER TABLE `tarifs` MODIFY `harga_pokok` DECIMAL(10,2) NOT NULL DEFAULT 0'
    );
  }
}
