import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddResetPasswordToUsers1783200000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` ADD `reset_password_token` VARCHAR(100) NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `users` ADD `reset_password_expires_at` DATETIME NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `users` DROP COLUMN `reset_password_expires_at`',
    );
    await queryRunner.query(
      'ALTER TABLE `users` DROP COLUMN `reset_password_token`',
    );
  }
}
