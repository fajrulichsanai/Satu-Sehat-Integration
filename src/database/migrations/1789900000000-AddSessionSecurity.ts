import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Session hardening: token_version (revoke all of a user's tokens, e.g. on
 * password reset), per-account login lockout counters, and a denylist of
 * individual tokens ended by logout/refresh.
 */
export class AddSessionSecurity1789900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotent: DB_SYNCHRONIZE may already have created these.
    const columns: Array<[string, string]> = [
      ['token_version', 'INT NOT NULL DEFAULT 0'],
      ['failed_login_attempts', 'INT NOT NULL DEFAULT 0'],
      ['locked_until', 'DATETIME NULL'],
    ];
    for (const [name, definition] of columns) {
      if (!(await queryRunner.hasColumn('users', name))) {
        await queryRunner.query(
          `ALTER TABLE \`users\` ADD COLUMN \`${name}\` ${definition}`,
        );
      }
    }
    if (await queryRunner.hasTable('revoked_tokens')) return;
    await queryRunner.query(`
      CREATE TABLE \`revoked_tokens\` (
        \`jti\` VARCHAR(36) NOT NULL,
        \`expires_at\` DATETIME NOT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`jti\`),
        INDEX \`IDX_revoked_tokens_expires_at\` (\`expires_at\`)
      ) ENGINE=InnoDB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`revoked_tokens\``);
    await queryRunner.query(`
      ALTER TABLE \`users\`
        DROP COLUMN \`token_version\`,
        DROP COLUMN \`failed_login_attempts\`,
        DROP COLUMN \`locked_until\`
    `);
  }
}
