import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveSatusehatColumnsFromClinic1718750000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    // Drop all 13 Satu Sehat columns from clinics table
    const columnsToDrop = [
      'satusehat_village_code',
      'satusehat_district_code',
      'satusehat_city_code',
      'satusehat_province_code',
      'satusehat_poli_location_id',
      'satusehat_layanan_org_id',
      'satusehat_divisi_org_id',
      'satusehat_token_expires_at',
      'satusehat_token',
      'satusehat_environment',
      'satusehat_client_secret',
      'satusehat_client_id',
      'satusehat_org_id',
    ];

    for (const columnName of columnsToDrop) {
      await queryRunner.query(
        `ALTER TABLE clinics DROP COLUMN ${columnName}`,
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback: add columns back
    await queryRunner.query(
      `ALTER TABLE clinics ADD COLUMN satusehat_org_id VARCHAR(100) NULLABLE`,
    );
    await queryRunner.query(
      `ALTER TABLE clinics ADD COLUMN satusehat_client_id VARCHAR(255) NULLABLE`,
    );
    await queryRunner.query(
      `ALTER TABLE clinics ADD COLUMN satusehat_client_secret VARCHAR(255) NULLABLE`,
    );
    await queryRunner.query(
      `ALTER TABLE clinics ADD COLUMN satusehat_environment ENUM('SANDBOX', 'PRODUCTION') DEFAULT 'SANDBOX'`,
    );
    await queryRunner.query(
      `ALTER TABLE clinics ADD COLUMN satusehat_token TEXT NULLABLE`,
    );
    await queryRunner.query(
      `ALTER TABLE clinics ADD COLUMN satusehat_token_expires_at DATETIME NULLABLE`,
    );
    await queryRunner.query(
      `ALTER TABLE clinics ADD COLUMN satusehat_divisi_org_id VARCHAR(100) NULLABLE`,
    );
    await queryRunner.query(
      `ALTER TABLE clinics ADD COLUMN satusehat_layanan_org_id VARCHAR(100) NULLABLE`,
    );
    await queryRunner.query(
      `ALTER TABLE clinics ADD COLUMN satusehat_poli_location_id VARCHAR(100) NULLABLE`,
    );
    await queryRunner.query(
      `ALTER TABLE clinics ADD COLUMN satusehat_province_code VARCHAR(10) NULLABLE`,
    );
    await queryRunner.query(
      `ALTER TABLE clinics ADD COLUMN satusehat_city_code VARCHAR(10) NULLABLE`,
    );
    await queryRunner.query(
      `ALTER TABLE clinics ADD COLUMN satusehat_district_code VARCHAR(10) NULLABLE`,
    );
    await queryRunner.query(
      `ALTER TABLE clinics ADD COLUMN satusehat_village_code VARCHAR(10) NULLABLE`,
    );
  }
}
