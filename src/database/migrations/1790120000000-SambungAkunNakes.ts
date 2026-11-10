import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sambungkan tautan akun ⇄ nakes yang hanya tercatat satu arah
 * (users.practitioner_id terisi, practitioners.user_id kosong). Akses pasien
 * per dokter memakai practitioners.user_id. Idempotent.
 */
export class SambungAkunNakes1790120000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE practitioners p
        JOIN users u ON u.practitioner_id = p.id AND u.clinic_id = p.clinic_id
         SET p.user_id = u.id
       WHERE p.user_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM (SELECT user_id FROM practitioners) x WHERE x.user_id = u.id)
    `);
  }

  async down(): Promise<void> {
    // Tidak dibalik: tautan dua arah adalah keadaan yang benar
  }
}
