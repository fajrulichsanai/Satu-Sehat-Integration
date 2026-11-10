import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Data tenaga kesehatan lengkap (profesi, TTL, alamat, masa berlaku SIP/STR)
 * + riwayat revisi data nakes. Idempotent (scripts/apply-security-schema.js).
 */
const COLUMNS: [string, string][] = [
  ['profession', 'varchar(30) NULL'],
  ['birth_place', 'varchar(100) NULL'],
  ['address', 'varchar(255) NULL'],
  ['sip_expired_at', 'date NULL'],
  ['str_expired_at', 'date NULL'],
];

export class DataNakes1790110000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, type] of COLUMNS) {
      if (!(await queryRunner.hasColumn('practitioners', name))) {
        await queryRunner.query(
          `ALTER TABLE \`practitioners\` ADD \`${name}\` ${type}`,
        );
      }
    }
    if (!(await queryRunner.hasTable('practitioner_revisions'))) {
      await queryRunner.query(`
        CREATE TABLE \`practitioner_revisions\` (
          \`id\` int NOT NULL AUTO_INCREMENT,
          \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`clinic_id\` int NOT NULL,
          \`practitioner_id\` int NOT NULL,
          \`changed_by\` int NULL,
          \`changed_by_name\` varchar(100) NULL,
          \`reason\` varchar(255) NULL,
          \`changes\` json NOT NULL,
          INDEX \`IDX_practitioner_revisions_prac\` (\`clinic_id\`, \`practitioner_id\`),
          PRIMARY KEY (\`id\`),
          CONSTRAINT \`FK_practitioner_revisions_prac\` FOREIGN KEY (\`practitioner_id\`)
            REFERENCES \`practitioners\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('practitioner_revisions')) {
      await queryRunner.query('DROP TABLE `practitioner_revisions`');
    }
    for (const [name] of COLUMNS) {
      if (await queryRunner.hasColumn('practitioners', name)) {
        await queryRunner.query(
          `ALTER TABLE \`practitioners\` DROP COLUMN \`${name}\``,
        );
      }
    }
  }
}
