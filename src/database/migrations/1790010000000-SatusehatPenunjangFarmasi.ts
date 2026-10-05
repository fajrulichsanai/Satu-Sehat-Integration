import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Playbook RME Rawat Jalan lengkap:
 *  - lab_orders / lab_results / radiology_orders (pemeriksaan penunjang)
 *  - prescription_items: racikan, pengeluaran & pemberian obat
 *  - prescription_reviews: pengkajian resep (Q0007)
 *  - encounter_soap_notes: diet, tujuan perawatan, penilaian risiko
 * Idempotent — aman di setiap deploy (scripts/apply-security-schema.js).
 */
export class SatusehatPenunjangFarmasi1790010000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const audit = `
      \`created_by\` INT NULL,
      \`updated_by\` INT NULL,
      \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`;

    if (!(await queryRunner.hasTable('lab_orders'))) {
      await queryRunner.query(`
        CREATE TABLE \`lab_orders\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`encounter_id\` INT NOT NULL,
          \`code\` VARCHAR(20) NOT NULL,
          \`code_system\` VARCHAR(100) NOT NULL DEFAULT 'http://loinc.org',
          \`display\` VARCHAR(255) NOT NULL,
          \`name_id\` VARCHAR(255) NOT NULL,
          \`category\` VARCHAR(50) NULL,
          \`specimen_type\` VARCHAR(50) NULL,
          \`fasting\` VARCHAR(20) NULL,
          \`note\` TEXT NULL,
          \`status\` VARCHAR(20) NOT NULL DEFAULT 'ordered',
          \`specimen_collected_at\` DATETIME NULL,
          \`resulted_at\` DATETIME NULL,
          \`conclusion\` TEXT NULL,
          ${audit},
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_lab_orders_encounter\` (\`encounter_id\`),
          CONSTRAINT \`FK_lab_orders_encounter\` FOREIGN KEY (\`encounter_id\`) REFERENCES \`encounters\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!(await queryRunner.hasTable('lab_results'))) {
      await queryRunner.query(`
        CREATE TABLE \`lab_results\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`order_id\` INT NOT NULL,
          \`code\` VARCHAR(20) NOT NULL,
          \`code_system\` VARCHAR(100) NOT NULL DEFAULT 'http://loinc.org',
          \`display\` VARCHAR(255) NOT NULL,
          \`name_id\` VARCHAR(255) NULL,
          \`value_number\` DECIMAL(14,4) NULL,
          \`unit\` VARCHAR(30) NULL,
          \`value_code\` VARCHAR(30) NULL,
          \`value_code_display\` VARCHAR(255) NULL,
          \`value_code_system\` VARCHAR(100) NULL,
          \`value_text\` TEXT NULL,
          \`ref_low\` DECIMAL(14,4) NULL,
          \`ref_high\` DECIMAL(14,4) NULL,
          \`interpretation\` VARCHAR(4) NULL,
          ${audit},
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_lab_results_order\` (\`order_id\`),
          CONSTRAINT \`FK_lab_results_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`lab_orders\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!(await queryRunner.hasTable('radiology_orders'))) {
      await queryRunner.query(`
        CREATE TABLE \`radiology_orders\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`encounter_id\` INT NOT NULL,
          \`code\` VARCHAR(20) NOT NULL,
          \`code_system\` VARCHAR(100) NOT NULL DEFAULT 'http://loinc.org',
          \`display\` VARCHAR(255) NOT NULL,
          \`name_id\` VARCHAR(255) NOT NULL,
          \`modality\` VARCHAR(4) NOT NULL,
          \`accession_number\` VARCHAR(40) NOT NULL,
          \`note\` TEXT NULL,
          \`status\` VARCHAR(20) NOT NULL DEFAULT 'ordered',
          \`result_text\` TEXT NULL,
          \`conclusion\` TEXT NULL,
          \`resulted_at\` DATETIME NULL,
          ${audit},
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`UQ_radiology_accession\` (\`accession_number\`),
          INDEX \`IDX_radiology_orders_encounter\` (\`encounter_id\`),
          CONSTRAINT \`FK_radiology_orders_encounter\` FOREIGN KEY (\`encounter_id\`) REFERENCES \`encounters\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!(await queryRunner.hasTable('prescription_reviews'))) {
      await queryRunner.query(`
        CREATE TABLE \`prescription_reviews\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`encounter_id\` INT NOT NULL,
          \`answers\` JSON NOT NULL,
          \`note\` TEXT NULL,
          \`reviewed_at\` DATETIME NOT NULL,
          \`reviewed_by\` INT NOT NULL,
          ${audit},
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`UQ_prescription_reviews_encounter\` (\`encounter_id\`),
          CONSTRAINT \`FK_prescription_reviews_encounter\` FOREIGN KEY (\`encounter_id\`) REFERENCES \`encounters\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }

    const columns: [string, string, string][] = [
      ['prescription_items', 'compound_type', 'VARCHAR(2) NULL'],
      ['prescription_items', 'compound_form_code', 'VARCHAR(10) NULL'],
      ['prescription_items', 'compound_form_name', 'VARCHAR(100) NULL'],
      ['prescription_items', 'compound_unit', 'VARCHAR(10) NULL'],
      ['prescription_items', 'ingredients', 'JSON NULL'],
      ['prescription_items', 'route_code', 'VARCHAR(10) NULL'],
      ['prescription_items', 'dispensed_at', 'DATETIME NULL'],
      ['prescription_items', 'dispensed_by', 'INT NULL'],
      ['prescription_items', 'batch_number', 'VARCHAR(50) NULL'],
      ['prescription_items', 'batch_expiry', 'DATE NULL'],
      ['prescription_items', 'administered_at', 'DATETIME NULL'],
      ['prescription_items', 'administered_by', 'INT NULL'],
      ['prescription_items', 'administered_dose', 'VARCHAR(100) NULL'],
      ['encounter_soap_notes', 'diet', 'JSON NULL'],
      ['encounter_soap_notes', 'goal', 'JSON NULL'],
      ['encounter_soap_notes', 'risk_assessment', 'JSON NULL'],
    ];
    for (const [table, column, definition] of columns) {
      if (!(await queryRunner.hasColumn(table, column))) {
        await queryRunner.query(
          `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
        );
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const t of [
      'prescription_reviews',
      'radiology_orders',
      'lab_results',
      'lab_orders',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS \`${t}\``);
    }
  }
}
