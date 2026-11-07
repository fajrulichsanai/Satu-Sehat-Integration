import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - tarifs.biaya_lab: biaya lab per tindakan (mis. crown, gigi tiruan).
 * - billing_items.harga_pokok / biaya_lab: salinan modal & biaya lab per unit
 *   saat transaksi dibuat, agar laporan lama tidak berubah saat tarif diubah.
 *   Baris lama diisi dari tarif saat ini.
 * - soap_templates.diagnoses / treatment: template SOAP ikut menyimpan
 *   diagnosis ICD-10/SNOMED dan tindakan.
 * - employee_salaries, payroll_runs, payroll_items: gaji pokok + bonus +
 *   share fee per bulan.
 * - stock_opnames, stock_opname_items: hasil hitung fisik stok BMHP.
 * Idempotent (scripts/apply-security-schema.js).
 */
export class BiayaLabPayrollTemplateOpname1790220000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const add = async (table: string, column: string, ddl: string) => {
      if ((await q.hasTable(table)) && !(await q.hasColumn(table, column))) {
        await q.query(`ALTER TABLE \`${table}\` ADD ${ddl}`);
      }
    };
    await add('tarifs', 'biaya_lab', '`biaya_lab` BIGINT NOT NULL DEFAULT 0');
    const hadSnapshot = await q.hasColumn('billing_items', 'harga_pokok');
    await add(
      'billing_items',
      'harga_pokok',
      '`harga_pokok` DECIMAL(12,2) NULL',
    );
    await add('billing_items', 'biaya_lab', '`biaya_lab` DECIMAL(12,2) NULL');
    if (!hadSnapshot) {
      await q.query(
        `UPDATE billing_items bi JOIN tarifs t ON t.id = bi.tarif_id
            SET bi.harga_pokok = t.harga_pokok, bi.biaya_lab = t.biaya_lab
          WHERE bi.harga_pokok IS NULL`,
      );
    }
    await add('soap_templates', 'diagnoses', '`diagnoses` JSON NULL');
    await add('soap_templates', 'treatment', '`treatment` TEXT NULL');

    if (!(await q.hasTable('employee_salaries'))) {
      await q.query(`
        CREATE TABLE \`employee_salaries\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`user_id\` INT NOT NULL,
          \`base_salary\` BIGINT NOT NULL DEFAULT 0,
          \`bank_name\` VARCHAR(50) NULL,
          \`bank_account\` VARCHAR(50) NULL,
          \`bank_holder\` VARCHAR(100) NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`UQ_employee_salary_user\` (\`clinic_id\`, \`user_id\`),
          CONSTRAINT \`FK_employee_salary_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!(await q.hasTable('payroll_runs'))) {
      await q.query(`
        CREATE TABLE \`payroll_runs\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`period\` CHAR(7) NOT NULL,
          \`status\` VARCHAR(10) NOT NULL DEFAULT 'draft',
          \`paid_at\` DATETIME NULL,
          \`created_by\` INT NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`UQ_payroll_run_period\` (\`clinic_id\`, \`period\`),
          CONSTRAINT \`FK_payroll_run_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!(await q.hasColumn('payroll_runs', 'operational_record_id'))) {
      // Catatan pengeluaran "gaji" yang dibuat saat payroll ditandai dibayar
      await q.query(
        'ALTER TABLE `payroll_runs` ADD `operational_record_id` INT NULL',
      );
    }
    if (!(await q.hasTable('payroll_items'))) {
      await q.query(`
        CREATE TABLE \`payroll_items\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`run_id\` INT NOT NULL,
          \`clinic_id\` INT NOT NULL,
          \`user_id\` INT NOT NULL,
          \`name\` VARCHAR(100) NOT NULL,
          \`role\` VARCHAR(30) NOT NULL,
          \`base_salary\` BIGINT NOT NULL DEFAULT 0,
          \`bonus\` BIGINT NOT NULL DEFAULT 0,
          \`deduction\` BIGINT NOT NULL DEFAULT 0,
          \`share_fee\` BIGINT NOT NULL DEFAULT 0,
          \`attendance\` JSON NULL,
          \`note\` VARCHAR(255) NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`UQ_payroll_item_user\` (\`run_id\`, \`user_id\`),
          CONSTRAINT \`FK_payroll_item_run\` FOREIGN KEY (\`run_id\`) REFERENCES \`payroll_runs\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!(await q.hasTable('stock_opnames'))) {
      await q.query(`
        CREATE TABLE \`stock_opnames\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`tanggal\` DATE NOT NULL,
          \`note\` VARCHAR(255) NULL,
          \`total_selisih_nilai\` BIGINT NOT NULL DEFAULT 0,
          \`created_by\` INT NULL,
          \`created_by_name\` VARCHAR(100) NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          KEY \`IDX_stock_opname_clinic\` (\`clinic_id\`),
          CONSTRAINT \`FK_stock_opname_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!(await q.hasTable('stock_opname_items'))) {
      await q.query(`
        CREATE TABLE \`stock_opname_items\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`opname_id\` INT NOT NULL,
          \`barang_id\` INT NOT NULL,
          \`name\` VARCHAR(150) NOT NULL,
          \`stok_sistem\` INT NOT NULL,
          \`stok_fisik\` INT NOT NULL,
          \`selisih\` INT NOT NULL,
          \`harga_beli\` DECIMAL(12,2) NOT NULL DEFAULT 0,
          \`catatan\` VARCHAR(255) NULL,
          PRIMARY KEY (\`id\`),
          KEY \`IDX_stock_opname_item\` (\`opname_id\`),
          CONSTRAINT \`FK_stock_opname_item\` FOREIGN KEY (\`opname_id\`) REFERENCES \`stock_opnames\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
  }

  async down(q: QueryRunner): Promise<void> {
    for (const t of [
      'stock_opname_items',
      'stock_opnames',
      'payroll_items',
      'payroll_runs',
      'employee_salaries',
    ]) {
      if (await q.hasTable(t)) await q.query(`DROP TABLE \`${t}\``);
    }
    for (const [table, column] of [
      ['soap_templates', 'treatment'],
      ['soap_templates', 'diagnoses'],
      ['billing_items', 'biaya_lab'],
      ['billing_items', 'harga_pokok'],
      ['tarifs', 'biaya_lab'],
    ]) {
      if (await q.hasColumn(table, column))
        await q.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
    }
  }
}
