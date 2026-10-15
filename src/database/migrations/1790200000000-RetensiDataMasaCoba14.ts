import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Masa coba 14 hari (sebelumnya 15).
 * - clinic_subscriptions.notified_h3_at: pengingat perpanjangan H-3.
 * - clinics.data_delete_after / data_delete_h7_at / data_delete_h1_at /
 *   data_purged_at: klinik yang berhenti berlangganan bisa mengunduh semua
 *   datanya sampai data_delete_after (15 hari setelah langganan berakhir),
 *   lalu data klinik dihapus. Kolom h7/h1 mencegah email pengingat ganda.
 * Idempotent (scripts/apply-security-schema.js).
 */
export class RetensiDataMasaCoba141790200000000 implements MigrationInterface {
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
      'clinic_subscriptions',
      'notified_h3_at',
      '`notified_h3_at` DATETIME NULL',
    );
    await add('clinics', 'data_delete_after', '`data_delete_after` DATE NULL');
    await add(
      'clinics',
      'data_delete_h7_at',
      '`data_delete_h7_at` DATETIME NULL',
    );
    await add(
      'clinics',
      'data_delete_h1_at',
      '`data_delete_h1_at` DATETIME NULL',
    );
    await add('clinics', 'data_purged_at', '`data_purged_at` DATETIME NULL');

    if (await queryRunner.hasTable('subscription_plans')) {
      await queryRunner.query(
        "UPDATE `subscription_plans` SET `duration_days` = 14 WHERE `tier` = 'trial' AND `duration_days` = 15",
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "UPDATE `subscription_plans` SET `duration_days` = 15 WHERE `tier` = 'trial' AND `duration_days` = 14",
    );
    for (const [table, column] of [
      ['clinics', 'data_purged_at'],
      ['clinics', 'data_delete_h1_at'],
      ['clinics', 'data_delete_h7_at'],
      ['clinics', 'data_delete_after'],
      ['clinic_subscriptions', 'notified_h3_at'],
    ]) {
      if (await queryRunner.hasColumn(table, column)) {
        await queryRunner.query(
          `ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``,
        );
      }
    }
  }
}
