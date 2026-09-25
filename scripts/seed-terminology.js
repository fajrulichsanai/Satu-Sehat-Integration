// Loads the diagnosis code systems (ICD-10, SNOMED CT) from
// data/terminology/*.tsv.gz into `terminology_concepts`, with the Indonesian
// names/aliases from src/modules/terminology/data/dental-id.ts. Idempotent
// and cheap when nothing changed: each system is reloaded only when its data
// file or the Indonesian list differs from what `terminology_meta` recorded.
// Run after `npm run build` and scripts/apply-security-schema.js (which
// creates the tables). Safe to run on every deploy.
require('dotenv').config();
const { DataSource } = require('typeorm');
const { createHash } = require('crypto');
const { readFileSync } = require('fs');
const { gunzipSync } = require('zlib');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SYSTEMS = ['icd10', 'snomed'];
const BATCH = 2000;

function aliasMap(system) {
  const { CURATED_DIAGNOSES } = require(
    path.join(ROOT, 'dist', 'modules', 'terminology', 'data', 'dental-id.js'),
  );
  const map = new Map();
  for (const d of CURATED_DIAGNOSES) {
    const code = system === 'icd10' ? d.icd10 : d.snomed;
    if (code) map.set(code, [d.nameId, ...d.aliases].join(' | '));
  }
  return map;
}

async function main() {
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
  let reloaded = false;
  try {
    for (const system of SYSTEMS) {
      const gz = readFileSync(
        path.join(ROOT, 'data', 'terminology', `${system}.tsv.gz`),
      );
      const aliases = aliasMap(system);
      const version = createHash('sha256')
        .update(gz)
        .update(JSON.stringify([...aliases]))
        .digest('hex')
        .slice(0, 32);

      const [meta] = await ds.query(
        'SELECT version, count FROM terminology_meta WHERE `system` = ?',
        [system],
      );
      if (meta && meta.version === version) {
        console.log(`✓ ${system}: up to date (${meta.count} codes)`);
        continue;
      }

      const rows = gunzipSync(gz)
        .toString('utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const tab = line.indexOf('\t');
          const code = line.slice(0, tab);
          return [
            system,
            code,
            line.slice(tab + 1).slice(0, 255),
            aliases.get(code) ?? null,
          ];
        });

      const started = Date.now();
      await ds.transaction(async (m) => {
        await m.query('DELETE FROM terminology_concepts WHERE `system` = ?', [
          system,
        ]);
        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH);
          await m.query(
            `INSERT INTO terminology_concepts (\`system\`, code, display, aliases) VALUES ${batch.map(() => '(?, ?, ?, ?)').join(', ')}
             ON DUPLICATE KEY UPDATE display = VALUES(display), aliases = VALUES(aliases)`,
            batch.flat(),
          );
        }
        await m.query(
          `INSERT INTO terminology_meta (\`system\`, version, count, loaded_at) VALUES (?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE version = VALUES(version), count = VALUES(count), loaded_at = NOW()`,
          [system, version, rows.length],
        );
      });
      reloaded = true;
      console.log(
        `✓ ${system}: loaded ${rows.length} codes in ${((Date.now() - started) / 1000).toFixed(1)}s`,
      );
    }
    if (reloaded) {
      // Rebuild the FULLTEXT index without the deleted rows — searches run
      // ~50x slower until this is done.
      await ds.query('OPTIMIZE TABLE terminology_concepts');
      console.log('✓ search index optimized');
    }
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error('Terminology seed failed:', err);
  process.exit(1);
});
