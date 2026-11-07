import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - subscription_plans.promo_owner_fee: biaya admin owner Multi Klinik saat
 *   promo. Multi Klinik bulanan: harga normal Rp249.000/klinik + Rp99.000
 *   admin owner, promo Rp124.000/klinik + Rp50.000 s.d. 31 Des 2026.
 * - subscription_payments.kind: 'new' (beli/perpanjang) atau 'upgrade'
 *   (naik paket, bayar selisih sisa hari; tidak menambah masa aktif).
 * - clinics.admin_pic_name / admin_pic_phone + clinic_admin_notes: catatan
 *   internal Super Admin per klinik (PRD UP-06).
 * Idempotent (scripts/apply-security-schema.js).
 */
export class PromoMultiNaikPaketCatatanKlinik1790210000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    const add = async (table: string, column: string, ddl: string) => {
      if (
        (await queryRunner.hasTable(table)) &&
        !(await queryRunner.hasColumn(table, column))
      ) {
        await queryRunner.query(`ALTER TABLE \`${table}\` ADD ${ddl}`);
      }
    };
    await add(
      'subscription_plans',
      'promo_owner_fee',
      '`promo_owner_fee` DECIMAL(12,2) NULL',
    );
    await add(
      'subscription_payments',
      'kind',
      "`kind` VARCHAR(20) NOT NULL DEFAULT 'new'",
    );
    await add('clinics', 'admin_pic_name', '`admin_pic_name` VARCHAR(100) NULL');
    await add('clinics', 'admin_pic_phone', '`admin_pic_phone` VARCHAR(30) NULL');

    if (!(await queryRunner.hasTable('clinic_admin_notes'))) {
      await queryRunner.query(`
        CREATE TABLE \`clinic_admin_notes\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`body\` TEXT NOT NULL,
          \`follow_up_on\` DATE NULL,
          \`done_at\` DATETIME NULL,
          \`created_by\` INT NULL,
          \`created_by_name\` VARCHAR(100) NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          KEY \`IDX_clinic_admin_notes_clinic\` (\`clinic_id\`),
          CONSTRAINT \`FK_clinic_admin_notes_clinic\` FOREIGN KEY (\`clinic_id\`)
            REFERENCES \`clinics\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (await queryRunner.hasTable('subscription_plans')) {
      await queryRunner.query(
        `UPDATE \`subscription_plans\`
            SET \`price\` = 249000, \`promo_price\` = 124000,
                \`owner_fee\` = 99000, \`promo_owner_fee\` = 50000,
                \`promo_until\` = '2026-12-31'
          WHERE \`tier\` = 'multi_klinik'
            AND (\`billing_cycle\` = 'monthly' OR \`billing_cycle\` IS NULL)
            AND \`price\` = 124000 AND \`promo_price\` IS NULL`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `subscription_plans` SET `price` = `promo_price`, `owner_fee` = COALESCE(`promo_owner_fee`, `owner_fee`) WHERE `tier` = 'multi_klinik' AND `promo_price` IS NOT NULL",
    );
    if (await queryRunner.hasTable('clinic_admin_notes')) {
      await queryRunner.query('DROP TABLE `clinic_admin_notes`');
    }
    for (const [table, column] of [
      ['clinics', 'admin_pic_phone'],
      ['clinics', 'admin_pic_name'],
      ['subscription_payments', 'kind'],
      ['subscription_plans', 'promo_owner_fee'],
    ]) {
      if (await queryRunner.hasColumn(table, column)) {
        await queryRunner.query(
          `ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``,
        );
      }
    }
  }
}
