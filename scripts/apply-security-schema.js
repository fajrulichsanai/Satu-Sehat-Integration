// Applies the schema for the security hardening (session revocation, login
// lockout, sync-log payload removal, ALERT audit action) directly and
// idempotently — the same approach as repair-subscription-plans.js, because
// the `migrations` bookkeeping table on staging is out of sync and
// `npm run migration:run` fails there. Runs the compiled TypeORM migrations'
// up() (each checks what already exists), without touching `migrations`.
// Safe to run on every deploy.
require('dotenv').config();
const { DataSource } = require('typeorm');
const path = require('path');

const MIGRATIONS = [
  '1789900000000-AddSessionSecurity',
  '1789910000000-DropSyncLogPayloads',
  '1789920000000-AddAuditAlertAction',
  '1789930000000-CreateApiKeys',
  '1789940000000-CreateTerminology',
  '1789950000000-SettleZeroBillings',
  '1789960000000-LegalConsentAndDataRequests',
  '1789970000000-CreateClinicContents',
  '1789980000000-CreateContentTemplates',
  '1789990000000-RestoreSatusehatIntegration',
  '1790000000000-SatusehatRmeRawatJalan',
];

async function main() {
  const ds = new DataSource({
    type: 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || 'dental_clinic',
  });
  await ds.initialize();
  const queryRunner = ds.createQueryRunner();
  try {
    for (const name of MIGRATIONS) {
      const mod = require(path.join(__dirname, '..', 'dist', 'database', 'migrations', `${name}.js`));
      const Migration = Object.values(mod)[0];
      await new Migration().up(queryRunner);
      console.log(`✓ ${name}`);
    }
  } finally {
    await queryRunner.release();
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('Security schema script failed:', err);
  process.exit(1);
});
