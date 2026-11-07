import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Harga promo per paket dan diskon lama langganan (keputusan 15 Okt 2026):
 * - subscription_plans.promo_price / promo_until: harga promo yang berlaku
 *   sampai tanggal itu (inklusif); `price` adalah harga normal (harga asli).
 * - subscription_payments.months / promo_discount / duration_discount:
 *   lama langganan yang dibayar (1, 3, 6, 12 bulan) dan rincian potongannya.
 * - Data: Starter & Pro bulanan yang masih Rp99.000 / Rp149.000 menjadi
 *   harga asli Rp199.000 / Rp299.000 dengan promo Rp99.000 / Rp149.000
 *   s.d. 31 Des 2026.
 * Idempotent (scripts/apply-security-schema.js).
 */
export class PromoDanDiskonDurasi1790190000000 implements MigrationInterface {
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
      'promo_price',
      '`promo_price` DECIMAL(12,2) NULL',
    );
    await add('subscription_plans', 'promo_until', '`promo_until` DATE NULL');
    await add(
      'subscription_payments',
      'months',
      '`months` INT NOT NULL DEFAULT 1',
    );
    await add(
      'subscription_payments',
      'promo_discount',
      '`promo_discount` DECIMAL(12,2) NOT NULL DEFAULT 0',
    );
    await add(
      'subscription_payments',
      'duration_discount',
      '`duration_discount` DECIMAL(12,2) NOT NULL DEFAULT 0',
    );

    // Only rows still at the launch price and without a promo yet.
    for (const [tier, promo, normal] of [
      ['basic', 99000, 199000],
      ['pro', 149000, 299000],
    ] as const) {
      await queryRunner.query(
        `UPDATE \`subscription_plans\`
            SET \`price\` = ?, \`promo_price\` = ?, \`promo_until\` = '2026-12-31'
          WHERE \`tier\` = ? AND (\`billing_cycle\` = 'monthly' OR \`billing_cycle\` IS NULL)
            AND \`price\` = ? AND \`promo_price\` IS NULL`,
        [normal, promo, tier, promo],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'UPDATE `subscription_plans` SET `price` = `promo_price` WHERE `promo_price` IS NOT NULL',
    );
    for (const [table, column] of [
      ['subscription_payments', 'duration_discount'],
      ['subscription_payments', 'promo_discount'],
      ['subscription_payments', 'months'],
      ['subscription_plans', 'promo_until'],
      ['subscription_plans', 'promo_price'],
    ]) {
      if (await queryRunner.hasColumn(table, column)) {
        await queryRunner.query(
          `ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``,
        );
      }
    }
  }
}
