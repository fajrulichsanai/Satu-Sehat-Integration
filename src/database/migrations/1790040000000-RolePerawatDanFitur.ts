import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Role "perawat" (aksesnya sama dengan dokter)
 * - Kontrol fitur: per klinik (super admin), per user (owner), dan fitur custom
 * Idempotent (scripts/apply-security-schema.js).
 */
export class RolePerawatDanFitur1790040000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const [col] = await queryRunner.query(
      "SELECT COLUMN_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'",
    );
    if (
      col &&
      String(col.type).startsWith('enum(') &&
      !String(col.type).includes("'perawat'")
    ) {
      await queryRunner.query(
        "ALTER TABLE `users` MODIFY `role` ENUM('super_admin','multi_clinic_owner','owner','admin','dokter','perawat','pending') NOT NULL",
      );
    }

    const audit = `
      \`created_by\` INT NULL,
      \`updated_by\` INT NULL,
      \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`;

    if (!(await queryRunner.hasTable('custom_features'))) {
      await queryRunner.query(`
        CREATE TABLE \`custom_features\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`key\` VARCHAR(60) NOT NULL,
          \`name\` VARCHAR(120) NOT NULL,
          \`description\` VARCHAR(500) NULL,
          ${audit},
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`UQ_custom_features_key\` (\`key\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!(await queryRunner.hasTable('clinic_features'))) {
      await queryRunner.query(`
        CREATE TABLE \`clinic_features\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`feature_key\` VARCHAR(60) NOT NULL,
          \`enabled\` TINYINT NOT NULL,
          ${audit},
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`UQ_clinic_features\` (\`clinic_id\`, \`feature_key\`),
          CONSTRAINT \`FK_clinic_features_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
    if (!(await queryRunner.hasTable('user_features'))) {
      await queryRunner.query(`
        CREATE TABLE \`user_features\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`user_id\` INT NOT NULL,
          \`clinic_id\` INT NOT NULL,
          \`feature_key\` VARCHAR(60) NOT NULL,
          \`enabled\` TINYINT NOT NULL,
          ${audit},
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`UQ_user_features\` (\`user_id\`, \`clinic_id\`, \`feature_key\`),
          INDEX \`IDX_user_features_clinic\` (\`clinic_id\`),
          CONSTRAINT \`FK_user_features_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`FK_user_features_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `user_features`');
    await queryRunner.query('DROP TABLE IF EXISTS `clinic_features`');
    await queryRunner.query('DROP TABLE IF EXISTS `custom_features`');
    await queryRunner.query(
      "UPDATE `users` SET `role` = 'pending' WHERE `role` = 'perawat'",
    );
    await queryRunner.query(
      "ALTER TABLE `users` MODIFY `role` ENUM('super_admin','multi_clinic_owner','owner','admin','dokter','pending') NOT NULL",
    );
  }
}
