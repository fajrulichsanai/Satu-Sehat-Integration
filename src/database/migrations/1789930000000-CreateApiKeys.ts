import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Public API: api_keys, per-day usage counters, and the doctors' public
 * profile (photo, practice hours). Idempotent — safe after DB_SYNCHRONIZE
 * and on every deploy (scripts/apply-security-schema.js).
 */
export class CreateApiKeys1789930000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('api_keys'))) {
      await queryRunner.query(`
        CREATE TABLE \`api_keys\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`name\` VARCHAR(100) NOT NULL,
          \`type\` ENUM('publishable','secret') NOT NULL,
          \`key_prefix\` VARCHAR(20) NOT NULL,
          \`key_hash\` CHAR(64) NOT NULL,
          \`allowed_origins\` JSON NULL,
          \`created_by\` INT NULL,
          \`last_used_at\` DATETIME NULL,
          \`revoked_at\` DATETIME NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`IDX_api_keys_key_hash\` (\`key_hash\`),
          INDEX \`IDX_api_keys_clinic\` (\`clinic_id\`)
        ) ENGINE=InnoDB
      `);
    }
    if (!(await queryRunner.hasTable('api_usage_daily'))) {
      await queryRunner.query(`
        CREATE TABLE \`api_usage_daily\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`api_key_id\` INT NOT NULL,
          \`date\` DATE NOT NULL,
          \`count\` INT NOT NULL DEFAULT 0,
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`IDX_api_usage_key_date\` (\`api_key_id\`, \`date\`),
          INDEX \`IDX_api_usage_clinic_date\` (\`clinic_id\`, \`date\`)
        ) ENGINE=InnoDB
      `);
    }
    const practitionerColumns: Array<[string, string]> = [
      ['photo_url', 'VARCHAR(500) NULL'],
      ['jadwal_praktik', 'JSON NULL'],
    ];
    for (const [name, definition] of practitionerColumns) {
      if (!(await queryRunner.hasColumn('practitioners', name))) {
        await queryRunner.query(`ALTER TABLE \`practitioners\` ADD COLUMN \`${name}\` ${definition}`);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `api_usage_daily`');
    await queryRunner.query('DROP TABLE IF EXISTS `api_keys`');
    for (const name of ['photo_url', 'jadwal_praktik']) {
      if (await queryRunner.hasColumn('practitioners', name)) {
        await queryRunner.query(`ALTER TABLE \`practitioners\` DROP COLUMN \`${name}\``);
      }
    }
  }
}
