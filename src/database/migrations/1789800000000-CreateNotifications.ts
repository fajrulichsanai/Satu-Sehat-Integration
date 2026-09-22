import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNotifications1789800000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`notifications\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`clinic_id\` INT NOT NULL,
        \`type\` ENUM('PATIENT_NEW','KUNJUNGAN_NEW','PAYMENT_NEW','USER_JOINED') NOT NULL,
        \`title\` VARCHAR(150) NOT NULL,
        \`message\` VARCHAR(255) NULL,
        \`entity_type\` VARCHAR(100) NULL,
        \`entity_id\` VARCHAR(100) NULL,
        \`actor_id\` INT NULL,
        \`actor_name\` VARCHAR(150) NULL,
        \`is_read\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        INDEX \`IDX_notifications_clinic_id_created_at\` (\`clinic_id\`, \`created_at\`),
        INDEX \`IDX_notifications_clinic_id_is_read\` (\`clinic_id\`, \`is_read\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `notifications`');
  }
}
