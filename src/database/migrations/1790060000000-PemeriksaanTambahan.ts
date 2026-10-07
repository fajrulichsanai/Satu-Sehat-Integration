import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pengukuran tambahan & temuan lain di Pemeriksaan Fisik (menggantikan modul
 * terpisah Kondisi & Observasi). Tabel modul lama dihapus bila kosong.
 * Idempotent (scripts/apply-security-schema.js).
 */
export class PemeriksaanTambahan1790060000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const columns: [string, string][] = [
      ['waist_circumference', 'DECIMAL(5,1) NULL'],
      ['head_circumference', 'DECIMAL(5,1) NULL'],
      ['gcs_total', 'TINYINT NULL'],
      ['blood_glucose', 'DECIMAL(5,1) NULL'],
      ['smoking_status', 'VARCHAR(20) NULL'],
      ['other_findings', 'TEXT NULL'],
    ];
    for (const [name, type] of columns) {
      if (!(await queryRunner.hasColumn('physical_examinations', name))) {
        await queryRunner.query(
          `ALTER TABLE \`physical_examinations\` ADD \`${name}\` ${type}`,
        );
      }
    }

    for (const table of ['clinical_observations', 'patient_conditions']) {
      if (!(await queryRunner.hasTable(table))) continue;
      const [row] = await queryRunner.query(
        `SELECT COUNT(*) AS n FROM \`${table}\``,
      );
      if (Number(row?.n ?? 0) === 0) {
        await queryRunner.query(`DROP TABLE \`${table}\``);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of [
      'waist_circumference',
      'head_circumference',
      'gcs_total',
      'blood_glucose',
      'smoking_status',
      'other_findings',
    ]) {
      if (await queryRunner.hasColumn('physical_examinations', name)) {
        await queryRunner.query(
          `ALTER TABLE \`physical_examinations\` DROP COLUMN \`${name}\``,
        );
      }
    }
  }
}
