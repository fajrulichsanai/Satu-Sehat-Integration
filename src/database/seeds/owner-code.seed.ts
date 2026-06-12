import { DataSource } from 'typeorm';

const OWNER_CODES = ['APEX001', 'APEX002', 'APEX003', 'APEX004', 'APEX005'];

export async function seedOwnerCodes(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();

  await queryRunner.createTable(
    {
      name: 'owner_codes',
      columns: [
        { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
        { name: 'code', type: 'varchar', length: '20', isUnique: true },
        { name: 'is_used', type: 'boolean', default: false },
        { name: 'used_by', type: 'int', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
    } as any,
    true,
  );

  for (const code of OWNER_CODES) {
    const exists = await queryRunner.query(
      `SELECT id FROM owner_codes WHERE code = ? LIMIT 1`,
      [code],
    );
    if (!exists.length) {
      await queryRunner.query(
        `INSERT INTO owner_codes (code) VALUES (?)`,
        [code],
      );
      console.log(`Seeded owner code: ${code}`);
    }
  }

  await queryRunner.release();
  console.log('Owner codes seeded successfully.');
}
