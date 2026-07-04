import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveUnusedPatientColumns1783100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Drop patient columns never wired to any frontend form (membership,
    // referral code, unused SATUSEHAT alt-id, unused active-status flag)
    const columnsToDrop = [
      'is_member',
      'member_id',
      'kode_referral',
      'status_aktif',
      'ihs_number',
    ];

    for (const columnName of columnsToDrop) {
      await queryRunner.query(`ALTER TABLE patients DROP COLUMN ${columnName}`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE patients ADD COLUMN ihs_number VARCHAR(50) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE patients ADD COLUMN status_aktif BOOLEAN NOT NULL DEFAULT TRUE`,
    );
    await queryRunner.query(
      `ALTER TABLE patients ADD COLUMN kode_referral VARCHAR(50) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE patients ADD COLUMN member_id VARCHAR(50) NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE patients ADD COLUMN is_member BOOLEAN NOT NULL DEFAULT FALSE`,
    );
  }
}
