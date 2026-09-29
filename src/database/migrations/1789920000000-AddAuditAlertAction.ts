import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds ALERT to audit_logs.action_type, for system-raised security alerts
 * such as bulk patient-record reads. */
export class AddAuditAlertAction1789920000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`audit_logs\`
        MODIFY \`action_type\` ENUM('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','EXPORT','VIEW','ALERT') NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM \`audit_logs\` WHERE \`action_type\` = 'ALERT'`);
    await queryRunner.query(`
      ALTER TABLE \`audit_logs\`
        MODIFY \`action_type\` ENUM('CREATE','UPDATE','DELETE','LOGIN','LOGOUT','EXPORT','VIEW') NOT NULL
    `);
  }
}
