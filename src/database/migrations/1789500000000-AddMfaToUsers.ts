import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMfaToUsers1789500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`users\`
        ADD COLUMN \`mfa_secret\` VARCHAR(255) NULL AFTER \`password_hash\`,
        ADD COLUMN \`mfa_enabled\` TINYINT(1) NOT NULL DEFAULT 0 AFTER \`mfa_secret\`,
        ADD COLUMN \`mfa_enabled_at\` DATETIME NULL AFTER \`mfa_enabled\`,
        ADD COLUMN \`mfa_backup_codes\` JSON NULL AFTER \`mfa_enabled_at\`
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`users\`
        DROP COLUMN \`mfa_secret\`,
        DROP COLUMN \`mfa_enabled\`,
        DROP COLUMN \`mfa_enabled_at\`,
        DROP COLUMN \`mfa_backup_codes\`
    `);
  }
}
