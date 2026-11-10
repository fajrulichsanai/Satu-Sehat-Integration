import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PRD Super Admin BL-01/02/05/06:
 * - subscription_plans.max_users: batas akun aktif per paket (null = bawaan
 *   tier: Starter 5, Pro & masa coba 25, Multi Klinik 25 per cabang).
 * - storage_addons: catatan storage tambahan (GB) yang dibeli owner atau
 *   diubah Super Admin — per klinik, atau per owner multiklinik (jatah
 *   bersama). Jumlah baris = GB tambahan yang berlaku.
 * - subscription_payments.extra_storage_gb / storage_amount: snapshot storage
 *   tambahan yang ikut ditagih dalam satu pembayaran.
 * Idempotent (scripts/apply-security-schema.js).
 */
export class BatasAkunStorageTambahan1790170000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (
      (await queryRunner.hasTable('subscription_plans')) &&
      !(await queryRunner.hasColumn('subscription_plans', 'max_users'))
    ) {
      await queryRunner.query('ALTER TABLE `subscription_plans` ADD `max_users` INT NULL');
    }

    if (!(await queryRunner.hasTable('storage_addons'))) {
      await queryRunner.query(`
        CREATE TABLE \`storage_addons\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NULL,
          \`owner_id\` INT NULL,
          \`gb\` INT NOT NULL,
          \`source\` VARCHAR(10) NOT NULL,
          \`note\` VARCHAR(255) NULL,
          \`created_by\` INT NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_storage_addons_clinic\` (\`clinic_id\`),
          INDEX \`IDX_storage_addons_owner\` (\`owner_id\`),
          CONSTRAINT \`FK_storage_addons_clinic\` FOREIGN KEY (\`clinic_id\`)
            REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`FK_storage_addons_owner\` FOREIGN KEY (\`owner_id\`)
            REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (await queryRunner.hasTable('subscription_payments')) {
      if (!(await queryRunner.hasColumn('subscription_payments', 'extra_storage_gb'))) {
        await queryRunner.query(
          'ALTER TABLE `subscription_payments` ADD `extra_storage_gb` INT NOT NULL DEFAULT 0',
        );
      }
      if (!(await queryRunner.hasColumn('subscription_payments', 'storage_amount'))) {
        await queryRunner.query(
          'ALTER TABLE `subscription_payments` ADD `storage_amount` DECIMAL(12,2) NOT NULL DEFAULT 0',
        );
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const col of ['storage_amount', 'extra_storage_gb']) {
      if (await queryRunner.hasColumn('subscription_payments', col)) {
        await queryRunner.query(`ALTER TABLE \`subscription_payments\` DROP COLUMN \`${col}\``);
      }
    }
    await queryRunner.query('DROP TABLE IF EXISTS `storage_addons`');
    if (await queryRunner.hasColumn('subscription_plans', 'max_users')) {
      await queryRunner.query('ALTER TABLE `subscription_plans` DROP COLUMN `max_users`');
    }
  }
}
