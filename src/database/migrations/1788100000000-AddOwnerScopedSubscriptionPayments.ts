import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOwnerScopedSubscriptionPayments1788100000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`subscription_payments\`
        MODIFY \`clinic_id\` INT NULL,
        ADD COLUMN \`owner_id\` INT NULL AFTER \`clinic_id\`,
        ADD COLUMN \`covered_clinic_ids\` JSON NULL AFTER \`quantity\`,
        ADD INDEX \`IDX_subscription_payments_owner_id\` (\`owner_id\`)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`subscription_payments\`
        DROP INDEX \`IDX_subscription_payments_owner_id\`,
        DROP COLUMN \`covered_clinic_ids\`,
        DROP COLUMN \`owner_id\`,
        MODIFY \`clinic_id\` INT NOT NULL
    `);
  }
}
