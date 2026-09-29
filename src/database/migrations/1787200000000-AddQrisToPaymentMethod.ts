import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddQrisToPaymentMethod1787200000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `payments` MODIFY COLUMN `method` ENUM('cash','transfer','qris','insurance','bpjs') NOT NULL",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `payments` MODIFY COLUMN `method` ENUM('cash','transfer','insurance','bpjs') NOT NULL",
    );
  }
}
