import { AppDataSource } from '../data-source';
import { seedOwnerCodes } from './owner-code.seed';

async function runSeeds() {
  await AppDataSource.initialize();
  console.log('Database connected. Running seeds...');

  await seedOwnerCodes(AppDataSource);

  await AppDataSource.destroy();
  console.log('Seeds complete.');
}

runSeeds().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
