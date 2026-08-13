import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptionTables1787000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`subscription_plans\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`name\` VARCHAR(100) NOT NULL,
        \`duration_days\` INT NOT NULL,
        \`price\` DECIMAL(12,2) NOT NULL,
        \`is_active\` TINYINT NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE \`clinic_subscriptions\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`clinic_id\` INT NOT NULL,
        \`plan_id\` INT NOT NULL,
        \`start_date\` DATE NOT NULL,
        \`end_date\` DATE NOT NULL,
        \`status\` ENUM('active','expired') NOT NULL DEFAULT 'active',
        \`extended_by\` INT NULL,
        \`notes\` TEXT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_clinic_subscriptions_clinic_id\` (\`clinic_id\`),
        INDEX \`IDX_clinic_subscriptions_clinic_id_created_at\` (\`clinic_id\`, \`created_at\`),
        CONSTRAINT \`FK_clinic_subscriptions_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\` (\`id\`),
        CONSTRAINT \`FK_clinic_subscriptions_plan\` FOREIGN KEY (\`plan_id\`) REFERENCES \`subscription_plans\` (\`id\`),
        CONSTRAINT \`FK_clinic_subscriptions_extended_by\` FOREIGN KEY (\`extended_by\`) REFERENCES \`users\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE \`subscription_payments\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`clinic_id\` INT NOT NULL,
        \`plan_id\` INT NOT NULL,
        \`subscription_id\` INT NULL,
        \`amount\` DECIMAL(12,2) NOT NULL,
        \`status\` ENUM('pending','confirmed','rejected') NOT NULL DEFAULT 'pending',
        \`confirmed_by\` INT NULL,
        \`confirmed_at\` DATETIME NULL,
        \`notes\` TEXT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_subscription_payments_clinic_id\` (\`clinic_id\`),
        INDEX \`IDX_subscription_payments_clinic_id_created_at\` (\`clinic_id\`, \`created_at\`),
        INDEX \`IDX_subscription_payments_status\` (\`status\`),
        CONSTRAINT \`FK_subscription_payments_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\` (\`id\`),
        CONSTRAINT \`FK_subscription_payments_plan\` FOREIGN KEY (\`plan_id\`) REFERENCES \`subscription_plans\` (\`id\`),
        CONSTRAINT \`FK_subscription_payments_subscription\` FOREIGN KEY (\`subscription_id\`) REFERENCES \`clinic_subscriptions\` (\`id\`),
        CONSTRAINT \`FK_subscription_payments_confirmed_by\` FOREIGN KEY (\`confirmed_by\`) REFERENCES \`users\` (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `subscription_payments`');
    await queryRunner.query('DROP TABLE `clinic_subscriptions`');
    await queryRunner.query('DROP TABLE `subscription_plans`');
  }
}
