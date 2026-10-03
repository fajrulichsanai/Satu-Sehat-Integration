// One-off repair: the project's `migrations` bookkeeping table is out of
// sync with the actual schema on staging (predates this change — running
// `npm run migration:run` there fails on an unrelated, already-applied old
// migration). This script applies just this feature's schema + seed data
// directly and idempotently, without touching the `migrations` table, so it
// is safe to run more than once.
require('dotenv').config();
const mysql = require('mysql2/promise');

async function columnExists(conn, database, table, column) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ?',
    [database, table, column],
  );
  return rows[0].cnt > 0;
}

async function main() {
  const database = process.env.DB_DATABASE || 'dental_clinic';
  console.log('NODE_ENV =', process.env.NODE_ENV);
  console.log('DB_DATABASE =', database);

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database,
  });

  const hasTier = await columnExists(conn, database, 'subscription_plans', 'tier');
  const hasCycle = await columnExists(conn, database, 'subscription_plans', 'billing_cycle');
  const hasOwnerFee = await columnExists(conn, database, 'subscription_plans', 'owner_fee');
  const hasQuantity = await columnExists(conn, database, 'subscription_payments', 'quantity');
  console.log('subscription_plans.tier exists?', hasTier);
  console.log('subscription_plans.billing_cycle exists?', hasCycle);
  console.log('subscription_plans.owner_fee exists?', hasOwnerFee);
  console.log('subscription_payments.quantity exists?', hasQuantity);

  if (!hasTier) {
    console.log('Adding subscription_plans.tier...');
    await conn.query('ALTER TABLE `subscription_plans` ADD COLUMN `tier` VARCHAR(20) NULL AFTER `is_active`');
  }
  if (!hasCycle) {
    console.log('Adding subscription_plans.billing_cycle...');
    await conn.query('ALTER TABLE `subscription_plans` ADD COLUMN `billing_cycle` VARCHAR(10) NULL AFTER `tier`');
  }
  if (!hasOwnerFee) {
    console.log('Adding subscription_plans.owner_fee...');
    await conn.query('ALTER TABLE `subscription_plans` ADD COLUMN `owner_fee` DECIMAL(12,2) NULL DEFAULT 0 AFTER `billing_cycle`');
  }
  if (!hasQuantity) {
    console.log('Adding subscription_payments.quantity...');
    await conn.query('ALTER TABLE `subscription_payments` ADD COLUMN `quantity` INT NOT NULL DEFAULT 1 AFTER `plan_id`');
  }

  const [existing] = await conn.query("SELECT COUNT(*) AS cnt FROM `subscription_plans` WHERE `tier` = 'multi_klinik'");
  console.log('Existing multi_klinik plan rows:', existing[0].cnt);

  if (existing[0].cnt === 0) {
    console.log('Deactivating legacy plans and seeding the 6 new tier plans...');
    await conn.query('UPDATE `subscription_plans` SET `is_active` = 0 WHERE `tier` IS NULL');
    await conn.query(`
      INSERT INTO \`subscription_plans\`
        (\`name\`, \`duration_days\`, \`price\`, \`is_active\`, \`tier\`, \`billing_cycle\`, \`owner_fee\`)
      VALUES
        ('Starter Bulanan', 30, 99000, 1, 'basic', 'monthly', 0),
        ('Starter Tahunan', 365, 990000, 1, 'basic', 'yearly', 0),
        ('Pro Bulanan', 30, 149000, 1, 'pro', 'monthly', 0),
        ('Pro Tahunan', 365, 1490000, 1, 'pro', 'yearly', 0),
        ('Multi Klinik Bulanan', 30, 149000, 1, 'multi_klinik', 'monthly', 99000),
        ('Multi Klinik Tahunan', 365, 1490000, 1, 'multi_klinik', 'yearly', 990000)
    `);
  } else {
    console.log('Tier plans already seeded, skipping insert.');
  }

  // Rename pre-existing "Basic ..." rows (from an earlier deploy, before the
  // Starter rename) — idempotent since a second run finds nothing left
  // matching 'Basic%'.
  const [renamed] = await conn.query(
    "UPDATE `subscription_plans` SET `name` = REPLACE(`name`, 'Basic', 'Starter') WHERE `tier` = 'basic' AND `name` LIKE 'Basic%'",
  );
  if (renamed.affectedRows > 0) {
    console.log(`Renamed ${renamed.affectedRows} 'Basic ...' plan(s) to 'Starter ...'.`);
  }

  // --- Free Trial 15 hari (PRD bagian 7) ---
  const hasTrialD7 = await columnExists(conn, database, 'clinic_subscriptions', 'notified_trial_d7_at');
  const hasTrialD13 = await columnExists(conn, database, 'clinic_subscriptions', 'notified_trial_d13_at');
  const hasTrialD15 = await columnExists(conn, database, 'clinic_subscriptions', 'notified_trial_d15_at');
  if (!hasTrialD7) {
    console.log('Adding clinic_subscriptions.notified_trial_d7_at...');
    await conn.query('ALTER TABLE `clinic_subscriptions` ADD COLUMN `notified_trial_d7_at` DATETIME NULL');
  }
  if (!hasTrialD13) {
    console.log('Adding clinic_subscriptions.notified_trial_d13_at...');
    await conn.query('ALTER TABLE `clinic_subscriptions` ADD COLUMN `notified_trial_d13_at` DATETIME NULL');
  }
  if (!hasTrialD15) {
    console.log('Adding clinic_subscriptions.notified_trial_d15_at...');
    await conn.query('ALTER TABLE `clinic_subscriptions` ADD COLUMN `notified_trial_d15_at` DATETIME NULL');
  }

  const [existingTrial] = await conn.query("SELECT COUNT(*) AS cnt FROM `subscription_plans` WHERE `tier` = 'trial'");
  if (existingTrial[0].cnt === 0) {
    console.log('Seeding Free Trial plan...');
    await conn.query(`
      INSERT INTO \`subscription_plans\`
        (\`name\`, \`duration_days\`, \`price\`, \`is_active\`, \`tier\`, \`billing_cycle\`, \`owner_fee\`)
      VALUES
        ('Free Trial 15 Hari', 15, 0, 1, 'trial', NULL, 0)
    `);
  } else {
    console.log('Free Trial plan already seeded, skipping insert.');
  }

  const [plans] = await conn.query(
    'SELECT id, name, tier, billing_cycle, price, owner_fee, is_active FROM `subscription_plans` ORDER BY id',
  );
  console.log('subscription_plans now:', JSON.stringify(plans, null, 2));

  const [migTable] = await conn.query("SHOW TABLES LIKE 'migrations'");
  if (migTable.length) {
    const [migCount] = await conn.query('SELECT COUNT(*) AS cnt FROM `migrations`');
    console.log('migrations table row count:', migCount[0].cnt);
  } else {
    console.log('No `migrations` table found.');
  }

  await conn.end();
  console.log('Repair script finished successfully.');
}

main().catch((err) => {
  console.error('Repair script failed:', err);
  process.exit(1);
});
