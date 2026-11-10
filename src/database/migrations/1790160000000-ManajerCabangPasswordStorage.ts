import { MigrationInterface, QueryRunner } from 'typeorm';

const ROLES_WITH_MANAGER =
  "'super_admin','multi_clinic_owner','owner','manajer_cabang','admin','dokter','perawat','pending'";
const ROLES_WITHOUT_MANAGER =
  "'super_admin','multi_clinic_owner','owner','admin','dokter','perawat','pending'";

/**
 * - Role Manajer Cabang (PRD Multi-Klinik MC-01).
 * - users.must_change_password: akun dengan password sementara wajib
 *   menggantinya saat login pertama (PRD Multi-Klinik alur A).
 * - storage_usage: catatan ukuran file layanan per klinik, untuk jatah
 *   storage per paket dan jatah bersama multiklinik.
 * - subscription_plans.storage_gb: jatah storage per paket (null = bawaan tier).
 * Idempotent (scripts/apply-security-schema.js).
 */
export class ManajerCabangPasswordStorage1790160000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const [col] = await queryRunner.query(
      "SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'",
    );
    if (
      col &&
      String(col.type).startsWith('enum(') &&
      !String(col.type).includes("'manajer_cabang'")
    ) {
      await queryRunner.query(
        `ALTER TABLE \`users\` MODIFY \`role\` ENUM(${ROLES_WITH_MANAGER}) NOT NULL`,
      );
    }

    if (!(await queryRunner.hasColumn('users', 'must_change_password'))) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD `must_change_password` TINYINT NOT NULL DEFAULT 0',
      );
    }

    if (!(await queryRunner.hasTable('storage_usage'))) {
      await queryRunner.query(`
        CREATE TABLE \`storage_usage\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`kind\` VARCHAR(30) NOT NULL,
          \`ref\` VARCHAR(500) NOT NULL,
          \`bytes\` BIGINT NOT NULL DEFAULT 0,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`UQ_storage_usage_kind_ref\` (\`kind\`, \`ref\`),
          INDEX \`IDX_storage_usage_clinic\` (\`clinic_id\`),
          CONSTRAINT \`FK_storage_usage_clinic\` FOREIGN KEY (\`clinic_id\`)
            REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (
      (await queryRunner.hasTable('subscription_plans')) &&
      !(await queryRunner.hasColumn('subscription_plans', 'storage_gb'))
    ) {
      await queryRunner.query(
        'ALTER TABLE `subscription_plans` ADD `storage_gb` INT NULL',
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('subscription_plans', 'storage_gb')) {
      await queryRunner.query(
        'ALTER TABLE `subscription_plans` DROP COLUMN `storage_gb`',
      );
    }
    await queryRunner.query('DROP TABLE IF EXISTS `storage_usage`');
    if (await queryRunner.hasColumn('users', 'must_change_password')) {
      await queryRunner.query(
        'ALTER TABLE `users` DROP COLUMN `must_change_password`',
      );
    }
    await queryRunner.query(
      "UPDATE `users` SET `role` = 'pending' WHERE `role` = 'manajer_cabang'",
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` MODIFY \`role\` ENUM(${ROLES_WITHOUT_MANAGER}) NOT NULL`,
    );
  }
}
