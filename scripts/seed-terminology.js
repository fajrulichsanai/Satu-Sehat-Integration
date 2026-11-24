// Loads the diagnosis code systems (ICD-10, SNOMED CT) from
// data/terminology/*.tsv.gz into `terminology_concepts`. The logic lives in
// src/modules/terminology/terminology-seed.ts (shared with the automatic
// seeding the app does on start). Idempotent and cheap when nothing changed.
// Run after `npm run build`. Safe to run on every deploy.
require('dotenv').config();
const { DataSource } = require('typeorm');
const path = require('path');

async function main() {
  const { seedTerminology } = require(
    path.join(__dirname, '..', 'dist', 'modules', 'terminology', 'terminology-seed.js'),
  );
  const ds = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'dental_clinic',
    charset: 'utf8mb4',
  });
  await ds.initialize();
  try {
    await seedTerminology(ds, (m) => console.log('✓ ' + m));
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('Terminology seed failed:', err);
  process.exit(1);
});
