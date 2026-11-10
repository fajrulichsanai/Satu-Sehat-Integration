import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Foto klinis boleh diunggah langsung ke pasien tanpa kunjungan:
 * patient_photos.encounter_id menjadi nullable. Idempotent.
 */
export class PatientPhotoWithoutEncounter1790250000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('patient_photos'))) return;
    await queryRunner.query(
      'ALTER TABLE `patient_photos` MODIFY `encounter_id` INT NULL',
    );
  }

  async down(): Promise<void> {
    // Tidak dibalik: baris tanpa kunjungan akan melanggar NOT NULL.
  }
}
