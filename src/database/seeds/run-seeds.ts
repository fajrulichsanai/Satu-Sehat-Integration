import { AppDataSource } from '../data-source';
import { seedOwnerCodes } from './owner-code.seed';
import { seedSuperAdmin } from './super-admin.seed';
import { seedSubscriptionPlans } from './subscription-plan.seed';

async function runSeeds() {
  await AppDataSource.initialize();
  console.log('Database connected. Running seeds...');

  await seedOwnerCodes(AppDataSource);
  await seedSuperAdmin(AppDataSource);
  await seedSubscriptionPlans(AppDataSource);

  await AppDataSource.destroy();
  console.log('Seeds complete.');
}

runSeeds().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
