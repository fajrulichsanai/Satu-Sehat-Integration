import { seedTerminology } from '../terminology-seed';

/** DataSource tiruan yang mengingat meta versi seperti MySQL asli. */
function fakeDataSource() {
  const meta = new Map<string, { version: string; count: number }>();
  const statements: string[] = [];
  const run = async (sql: string, params: unknown[] = []) => {
    statements.push(sql.trim().split('\n')[0].slice(0, 60));
    if (sql.startsWith('SELECT version')) {
      const m = meta.get(params[0] as string);
      return m ? [m] : [];
    }
    if (sql.includes('INSERT INTO terminology_meta')) {
      meta.set(params[0] as string, { version: params[1] as string, count: params[2] as number });
    }
    return [];
  };
  const ds = {
    query: jest.fn(run),
    transaction: jest.fn(async (cb: (m: { query: typeof run }) => Promise<void>) => cb({ query: run })),
  };
  return { ds: ds as any, statements };
}

describe('seedTerminology', () => {
  it('membuat tabel dan memuat ICD-10 serta SNOMED bila belum ada (positive)', async () => {
    const { ds, statements } = fakeDataSource();
    const result = await seedTerminology(ds);
    expect(result.reloaded).toEqual(['icd10', 'snomed']);
    expect(statements.filter((s) => s.startsWith('CREATE TABLE'))).toHaveLength(2);
    expect(statements.some((s) => s.startsWith('OPTIMIZE TABLE'))).toBe(true);
  }, 60000);

  it('tidak memuat ulang bila versi sama (idempotent, edge)', async () => {
    const { ds, statements } = fakeDataSource();
    await seedTerminology(ds);
    statements.length = 0;
    const second = await seedTerminology(ds);
    expect(second.reloaded).toEqual([]);
    expect(second.upToDate).toEqual(['icd10', 'snomed']);
    expect(statements.some((s) => s.startsWith('DELETE'))).toBe(false);
  }, 60000);
});
