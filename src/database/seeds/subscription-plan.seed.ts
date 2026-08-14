import { DataSource } from 'typeorm';

const PLANS = [
  { name: 'Bulanan', durationDays: 30, price: 150000 },
  { name: 'Triwulan', durationDays: 90, price: 400000 },
  { name: 'Tahunan', durationDays: 365, price: 1500000 },
];

export async function seedSubscriptionPlans(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();

  const existing = await queryRunner.query(
    `SELECT id FROM subscription_plans LIMIT 1`,
  );

  if (existing.length) {
    console.log('Subscription plans already exist, skipping seed.');
    await queryRunner.release();
    return;
  }

  for (const plan of PLANS) {
    await queryRunner.query(
      `INSERT INTO subscription_plans (name, duration_days, price, is_active, created_at, updated_at)
       VALUES (?, ?, ?, true, NOW(), NOW())`,
      [plan.name, plan.durationDays, plan.price],
    );
  }

  console.log(`Seeded ${PLANS.length} subscription plans.`);

  await queryRunner.release();
}
