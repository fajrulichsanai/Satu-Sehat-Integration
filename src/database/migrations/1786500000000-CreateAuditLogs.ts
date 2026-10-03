import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditLogs1786500000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`audit_logs\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`clinic_id\` INT NULL,
        \`actor_id\` INT NULL,
        \`actor_name\` VARCHAR(150) NOT NULL,
        \`actor_role\` VARCHAR(50) NOT NULL,
        \`action_type\` ENUM('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','EXPORT','VIEW') NOT NULL,
        \`entity_type\` VARCHAR(100) NOT NULL,
        \`entity_id\` VARCHAR(100) NULL,
        \`entity_label\` VARCHAR(255) NULL,
        \`before_value\` JSON NULL,
        \`after_value\` JSON NULL,
        \`status\` ENUM('SUCCESS','FAILED') NOT NULL DEFAULT 'SUCCESS',
        \`failure_reason\` VARCHAR(255) NULL,
        \`ip_address\` VARCHAR(64) NULL,
        \`user_agent\` VARCHAR(255) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_audit_logs_clinic_id\` (\`clinic_id\`),
        INDEX \`IDX_audit_logs_clinic_id_created_at\` (\`clinic_id\`, \`created_at\`),
        INDEX \`IDX_audit_logs_entity_type_entity_id\` (\`entity_type\`, \`entity_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `audit_logs`');
  }
}
