import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubscriptionTiersAndQuantity1787800000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`subscription_plans\`
        ADD COLUMN \`tier\` VARCHAR(20) NULL AFTER \`is_active\`,
        ADD COLUMN \`billing_cycle\` VARCHAR(10) NULL AFTER \`tier\`,
        ADD COLUMN \`owner_fee\` DECIMAL(12,2) NULL DEFAULT 0 AFTER \`billing_cycle\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`subscription_payments\`
        ADD COLUMN \`quantity\` INT NOT NULL DEFAULT 1 AFTER \`plan_id\`
    `);

    // Old flat plans (Bulanan/Triwulan/Tahunan, etc.) have no tier — retire
    // them in favor of the new Basic/Pro/Multi Klinik tiers below. Existing
    // ClinicSubscription/SubscriptionPayment rows still reference them by
    // planId, so they're deactivated, never deleted.
    await queryRunner.query(`
      UPDATE \`subscription_plans\` SET \`is_active\` = 0 WHERE \`tier\` IS NULL
    `);

    // Yearly price = monthly price * 10 (2 months free), applied to both
    // the per-unit price and Multi Klinik's owner fee for consistency.
    await queryRunner.query(`
      INSERT INTO \`subscription_plans\`
        (\`name\`, \`duration_days\`, \`price\`, \`is_active\`, \`tier\`, \`billing_cycle\`, \`owner_fee\`)
      VALUES
        ('Basic Bulanan', 30, 99000, 1, 'basic', 'monthly', 0),
        ('Basic Tahunan', 365, 990000, 1, 'basic', 'yearly', 0),
        ('Pro Bulanan', 30, 149000, 1, 'pro', 'monthly', 0),
        ('Pro Tahunan', 365, 1490000, 1, 'pro', 'yearly', 0),
        ('Multi Klinik Bulanan', 30, 149000, 1, 'multi_klinik', 'monthly', 99000),
        ('Multi Klinik Tahunan', 365, 1490000, 1, 'multi_klinik', 'yearly', 990000)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM \`subscription_plans\` WHERE \`tier\` IN ('basic', 'pro', 'multi_klinik')
    `);
    await queryRunner.query(`
      ALTER TABLE \`subscription_payments\` DROP COLUMN \`quantity\`
    `);
    await queryRunner.query(`
      ALTER TABLE \`subscription_plans\`
        DROP COLUMN \`owner_fee\`,
        DROP COLUMN \`billing_cycle\`,
        DROP COLUMN \`tier\`
    `);
  }
}
