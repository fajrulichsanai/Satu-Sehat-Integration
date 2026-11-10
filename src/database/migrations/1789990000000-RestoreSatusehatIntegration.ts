import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Menghidupkan kembali integrasi SATUSEHAT (sebelumnya dihapus oleh
 * RemoveSatusehatColumnsFromClinic):
 *  - kolom konfigurasi SATUSEHAT di `clinics` (client secret terenkripsi)
 *  - kode KFA di `prescription_items` agar resep bisa dikirim
 *  - `satusehat_resource_links`: ID resource SATUSEHAT untuk data yang tidak
 *    punya kolom sendiri (observasi, kondisi dari SOAP, resep, dll.), supaya
 *    kirim ulang memakai PUT dan tidak membuat data ganda.
 * Idempotent — aman di setiap deploy (scripts/apply-security-schema.js).
 */
export class RestoreSatusehatIntegration1789990000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const clinicColumns: [string, string][] = [
      ['satusehat_org_id', 'VARCHAR(100) NULL'],
      ['satusehat_client_id', 'VARCHAR(255) NULL'],
      ['satusehat_client_secret', 'VARCHAR(512) NULL'],
      [
        'satusehat_environment',
        "ENUM('sandbox', 'production') NOT NULL DEFAULT 'sandbox'",
      ],
      ['satusehat_token', 'TEXT NULL'],
      ['satusehat_token_expires_at', 'DATETIME NULL'],
      ['satusehat_poli_location_id', 'VARCHAR(100) NULL'],
    ];
    for (const [column, definition] of clinicColumns) {
      if (!(await queryRunner.hasColumn('clinics', column))) {
        await queryRunner.query(
          `ALTER TABLE \`clinics\` ADD COLUMN \`${column}\` ${definition}`,
        );
      }
    }

    for (const [column, definition] of [
      ['kfa_code', 'VARCHAR(20) NULL'],
      ['kfa_name', 'VARCHAR(255) NULL'],
    ]) {
      if (!(await queryRunner.hasColumn('prescription_items', column))) {
        await queryRunner.query(
          `ALTER TABLE \`prescription_items\` ADD COLUMN \`${column}\` ${definition}`,
        );
      }
    }

    if (!(await queryRunner.hasTable('satusehat_resource_links'))) {
      await queryRunner.query(`
        CREATE TABLE \`satusehat_resource_links\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`local_type\` VARCHAR(50) NOT NULL,
          \`local_id\` INT NOT NULL,
          \`resource_type\` VARCHAR(50) NOT NULL,
          \`satusehat_id\` VARCHAR(100) NOT NULL,
          \`created_by\` INT NULL,
          \`updated_by\` INT NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`UQ_satusehat_link_local\` (\`clinic_id\`, \`local_type\`, \`local_id\`),
          CONSTRAINT \`FK_satusehat_link_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('satusehat_resource_links')) {
      await queryRunner.query('DROP TABLE `satusehat_resource_links`');
    }
    for (const column of ['kfa_code', 'kfa_name']) {
      if (await queryRunner.hasColumn('prescription_items', column)) {
        await queryRunner.query(
          `ALTER TABLE \`prescription_items\` DROP COLUMN \`${column}\``,
        );
      }
    }
    for (const column of [
      'satusehat_poli_location_id',
      'satusehat_token_expires_at',
      'satusehat_token',
      'satusehat_environment',
      'satusehat_client_secret',
      'satusehat_client_id',
      'satusehat_org_id',
    ]) {
      if (await queryRunner.hasColumn('clinics', column)) {
        await queryRunner.query(
          `ALTER TABLE \`clinics\` DROP COLUMN \`${column}\``,
        );
      }
    }
  }
}
