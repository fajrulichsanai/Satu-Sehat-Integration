import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records which Syarat & Ketentuan / Kebijakan Privasi version each user
 * accepted at sign-up, and adds data_requests for UU PDP data-subject
 * requests (export data, close account). Idempotent — safe on every deploy
 * (scripts/apply-security-schema.js).
 */
export class LegalConsentAndDataRequests1789960000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('users', 'terms_accepted_at'))) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD `terms_accepted_at` DATETIME NULL',
      );
    }
    if (!(await queryRunner.hasColumn('users', 'terms_version'))) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD `terms_version` VARCHAR(20) NULL',
      );
    }
    if (!(await queryRunner.hasTable('data_requests'))) {
      await queryRunner.query(`
        CREATE TABLE \`data_requests\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`requested_by_id\` INT NOT NULL,
          \`type\` ENUM('export', 'close_account') NOT NULL,
          \`reason\` TEXT NULL,
          \`status\` ENUM('pending', 'in_progress', 'completed', 'rejected') NOT NULL DEFAULT 'pending',
          \`admin_note\` TEXT NULL,
          \`handled_by_id\` INT NULL,
          \`completed_at\` DATETIME NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_data_requests_clinic_status\` (\`clinic_id\`, \`status\`),
          CONSTRAINT \`FK_data_requests_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\` (\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`FK_data_requests_user\` FOREIGN KEY (\`requested_by_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `data_requests`');
    if (await queryRunner.hasColumn('users', 'terms_version')) {
      await queryRunner.query(
        'ALTER TABLE `users` DROP COLUMN `terms_version`',
      );
    }
    if (await queryRunner.hasColumn('users', 'terms_accepted_at')) {
      await queryRunner.query(
        'ALTER TABLE `users` DROP COLUMN `terms_accepted_at`',
      );
    }
  }
}
