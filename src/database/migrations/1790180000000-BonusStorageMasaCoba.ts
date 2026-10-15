import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - storage_addons.is_free / free_until / reminded_at: storage bonus dari
 *   Super Admin yang gratis sampai tanggal tertentu (atau selamanya), lalu
 *   ikut ditagih; reminded_at mencegah email pengingat terkirim dua kali.
 * - subscription_plans.storage_gb jadi desimal, agar paket bisa diberi
 *   jatah di bawah 1 GB (masa coba 0,1 GB = 100 MB).
 * Idempotent (scripts/apply-security-schema.js).
 */
export class BonusStorageMasaCoba1790180000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('storage_addons')) {
      if (!(await queryRunner.hasColumn('storage_addons', 'is_free'))) {
        await queryRunner.query(
          'ALTER TABLE `storage_addons` ADD `is_free` TINYINT NOT NULL DEFAULT 0',
        );
      }
      if (!(await queryRunner.hasColumn('storage_addons', 'free_until'))) {
        await queryRunner.query(
          'ALTER TABLE `storage_addons` ADD `free_until` DATE NULL',
        );
      }
      if (!(await queryRunner.hasColumn('storage_addons', 'reminded_at'))) {
        await queryRunner.query(
          'ALTER TABLE `storage_addons` ADD `reminded_at` DATETIME NULL',
        );
      }
    }
    const [col] = await queryRunner.query(
      "SELECT DATA_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'storage_gb'",
    );
    if (col && String(col.type).toLowerCase() !== 'decimal') {
      await queryRunner.query(
        'ALTER TABLE `subscription_plans` MODIFY `storage_gb` DECIMAL(10,2) NULL',
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `subscription_plans` MODIFY `storage_gb` INT NULL',
    );
    for (const c of ['reminded_at', 'free_until', 'is_free']) {
      if (await queryRunner.hasColumn('storage_addons', c)) {
        await queryRunner.query(
          `ALTER TABLE \`storage_addons\` DROP COLUMN \`${c}\``,
        );
      }
    }
  }
}
