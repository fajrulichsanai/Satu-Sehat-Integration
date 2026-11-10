import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Data terkode tambahan untuk Playbook SATUSEHAT "RME Rawat Jalan" (poli umum
 * & gigi):
 *  - SOAP: keluhan utama SNOMED CT, edukasi, kondisi saat pulang, prognosis
 *  - Pemeriksaan fisik: status psikologis & status kehamilan
 *  - `kfa_products`: salinan lokal katalog obat KFA
 * Idempotent — aman di setiap deploy (scripts/apply-security-schema.js).
 */
export class SatusehatRmeRawatJalan1790000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const columns: [string, string, string][] = [
      ['encounter_soap_notes', 'chief_complaint_code', 'VARCHAR(20) NULL'],
      ['encounter_soap_notes', 'chief_complaint_display', 'VARCHAR(255) NULL'],
      ['encounter_soap_notes', 'education_given', 'TINYINT(1) NULL'],
      ['encounter_soap_notes', 'discharge_condition', 'VARCHAR(20) NULL'],
      ['encounter_soap_notes', 'prognosis', 'VARCHAR(20) NULL'],
      ['physical_examinations', 'psychological_status', 'VARCHAR(20) NULL'],
      ['physical_examinations', 'psychological_note', 'VARCHAR(255) NULL'],
      ['physical_examinations', 'pregnancy_status', 'VARCHAR(20) NULL'],
    ];
    for (const [table, column, definition] of columns) {
      if (!(await queryRunner.hasColumn(table, column))) {
        await queryRunner.query(
          `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
        );
      }
    }

    if (!(await queryRunner.hasTable('kfa_products'))) {
      await queryRunner.query(`
        CREATE TABLE \`kfa_products\` (
          \`kfa_code\` VARCHAR(20) NOT NULL,
          \`name\` VARCHAR(512) NOT NULL,
          \`active\` TINYINT(1) NOT NULL DEFAULT 1,
          \`product_group\` VARCHAR(20) NULL,
          \`dosage_form_code\` VARCHAR(20) NULL,
          \`dosage_form_name\` VARCHAR(255) NULL,
          \`route_code\` VARCHAR(20) NULL,
          \`route_name\` VARCHAR(255) NULL,
          \`uom\` VARCHAR(100) NULL,
          \`manufacturer\` VARCHAR(255) NULL,
          \`nie\` VARCHAR(100) NULL,
          \`generic\` TINYINT(1) NULL,
          \`template_code\` VARCHAR(20) NULL,
          \`template_name\` VARCHAR(512) NULL,
          \`active_ingredients\` JSON NULL,
          \`kfa_updated_at\` DATETIME NULL,
          \`synced_at\` DATETIME NOT NULL,
          PRIMARY KEY (\`kfa_code\`),
          INDEX \`IDX_kfa_products_name\` (\`name\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `kfa_products`');
    for (const [table, column] of [
      ['physical_examinations', 'pregnancy_status'],
      ['physical_examinations', 'psychological_note'],
      ['physical_examinations', 'psychological_status'],
      ['encounter_soap_notes', 'prognosis'],
      ['encounter_soap_notes', 'discharge_condition'],
      ['encounter_soap_notes', 'education_given'],
      ['encounter_soap_notes', 'chief_complaint_display'],
      ['encounter_soap_notes', 'chief_complaint_code'],
    ]) {
      if (await queryRunner.hasColumn(table, column)) {
        await queryRunner.query(
          `ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``,
        );
      }
    }
  }
}
