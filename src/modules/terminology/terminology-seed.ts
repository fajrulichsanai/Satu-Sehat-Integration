import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { gunzipSync } from 'zlib';
import * as path from 'path';
import type { DataSource } from 'typeorm';
import { CURATED_DIAGNOSES } from './data/dental-id';

/**
 * Memuat kode diagnosis (ICD-10, SNOMED CT) dari data/terminology/*.tsv.gz ke
 * `terminology_concepts`, lengkap dengan nama/alias Indonesia. Idempotent dan
 * murah bila tidak ada perubahan: tiap sistem dimuat ulang hanya bila versi
 * (hash berkas + daftar Indonesia) berbeda dari `terminology_meta`.
 * Dipakai oleh scripts/seed-terminology.js (deploy) dan TerminologySeedService
 * (otomatis saat aplikasi start, supaya server mana pun yang lupa menjalankan
 * skrip tetap punya data diagnosis).
 */
const SYSTEMS = ['icd10', 'snomed'] as const;
const BATCH = 2000;
const DATA_DIR = path.resolve(__dirname, '../../../data/terminology');

const aliasMap = (system: (typeof SYSTEMS)[number]) => {
  const map = new Map<string, string>();
  for (const d of CURATED_DIAGNOSES) {
    const code = system === 'icd10' ? d.icd10 : d.snomed;
    if (code) map.set(code, [d.nameId, ...d.aliases].join(' | '));
  }
  return map;
};

export const CREATE_TERMINOLOGY_TABLES = [
  `CREATE TABLE IF NOT EXISTS \`terminology_concepts\` (
     \`id\` INT NOT NULL AUTO_INCREMENT,
     \`system\` VARCHAR(10) NOT NULL,
     \`code\` VARCHAR(20) NOT NULL,
     \`display\` VARCHAR(255) NOT NULL,
     \`aliases\` TEXT NULL,
     PRIMARY KEY (\`id\`),
     UNIQUE INDEX \`IDX_terminology_system_code\` (\`system\`, \`code\`),
     FULLTEXT INDEX \`FT_terminology_text\` (\`display\`, \`aliases\`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS \`terminology_meta\` (
     \`system\` VARCHAR(10) NOT NULL,
     \`version\` VARCHAR(64) NOT NULL,
     \`count\` INT NOT NULL,
     \`loaded_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (\`system\`)
   ) ENGINE=InnoDB`,
];

export interface SeedResult {
  reloaded: string[];
  upToDate: string[];
}

export async function seedTerminology(
  ds: DataSource,
  log: (msg: string) => void = () => undefined,
  dataDir = DATA_DIR,
): Promise<SeedResult> {
  const result: SeedResult = { reloaded: [], upToDate: [] };
  // Tabel dibuat bila belum ada (server yang belum pernah menjalankan skema keamanan).
  for (const ddl of CREATE_TERMINOLOGY_TABLES) await ds.query(ddl);

  for (const system of SYSTEMS) {
    const gz = readFileSync(path.join(dataDir, `${system}.tsv.gz`));
    const aliases = aliasMap(system);
    const version = createHash('sha256')
      .update(gz)
      .update(JSON.stringify([...aliases]))
      .digest('hex')
      .slice(0, 32);

    const [meta] = (await ds.query(
      'SELECT version, count FROM terminology_meta WHERE `system` = ?',
      [system],
    )) as Array<{ version: string; count: number }>;
    if (meta && meta.version === version) {
      log(`${system}: sudah terbaru (${meta.count} kode)`);
      result.upToDate.push(system);
      continue;
    }

    const rows = gunzipSync(gz)
      .toString('utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const tab = line.indexOf('\t');
        const code = line.slice(0, tab);
        return [system, code, line.slice(tab + 1).slice(0, 255), aliases.get(code) ?? null];
      });

    const started = Date.now();
    await ds.transaction(async (m) => {
      await m.query('DELETE FROM terminology_concepts WHERE `system` = ?', [system]);
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
    result.reloaded.push(system);
    log(`${system}: ${rows.length} kode dimuat dalam ${((Date.now() - started) / 1000).toFixed(1)} dtk`);
  }

  if (result.reloaded.length) {
    // Bangun ulang indeks FULLTEXT tanpa baris yang dihapus — pencarian ~50x lebih lambat sebelum ini.
    await ds.query('OPTIMIZE TABLE terminology_concepts');
    log('indeks pencarian dioptimalkan');
  }
  return result;
}
