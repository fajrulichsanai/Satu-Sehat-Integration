import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../../enums';

export async function seedSuperAdmin(dataSource: DataSource): Promise<void> {
  const email = process.env.SUPER_ADMIN_EMAIL || 'superadmin@apexrecord.local';
  const password = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!';

  const queryRunner = dataSource.createQueryRunner();

  const existing = await queryRunner.query(
    `SELECT id FROM users WHERE role = ? LIMIT 1`,
    [UserRole.SUPER_ADMIN],
  );

  if (existing.length) {
    console.log('Super admin already exists, skipping seed.');
    await queryRunner.release();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await queryRunner.query(
    `INSERT INTO users (email, password_hash, name, role, is_active, email_verified_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, true, NOW(), NOW(), NOW())`,
    [email, passwordHash, 'Super Admin', UserRole.SUPER_ADMIN],
  );

  console.log(`Seeded super admin: ${email} (change the password after first login)`);

  await queryRunner.release();
}
