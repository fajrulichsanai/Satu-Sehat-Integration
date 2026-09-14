import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Replaces `whole_condition` (a single catch-all enum) with the
 * `teks_atas`/`teks_bawah` annotation pair plus an independent `rct`
 * boolean, matching the Kemenkes-aligned odontogram reference this module
 * is based on — a tooth can carry RCT alongside a teks_atas/teks_bawah
 * annotation, which the old mutually-exclusive enum couldn't express.
 */
export class UpdateOdontogramAnnotations1789700000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`tooth_conditions\`
        DROP COLUMN \`whole_condition\`,
        ADD COLUMN \`teks_atas\` VARCHAR(10) NULL AFTER \`tooth_number\`,
        ADD COLUMN \`teks_bawah\` VARCHAR(10) NULL AFTER \`teks_atas\`,
        ADD COLUMN \`rct\` TINYINT(1) NOT NULL DEFAULT 0 AFTER \`teks_bawah\`
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`tooth_conditions\`
        DROP COLUMN \`teks_atas\`,
        DROP COLUMN \`teks_bawah\`,
        DROP COLUMN \`rct\`,
        ADD COLUMN \`whole_condition\` VARCHAR(30) NULL AFTER \`tooth_number\`
    `);
  }
}
