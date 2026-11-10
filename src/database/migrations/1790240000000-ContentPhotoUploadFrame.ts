import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Konten series: foto bisa diunggah langsung dari perangkat (source_type
 * 'upload' + file_url) dan tiap foto menyimpan frame (zoom/geser/putar).
 * Idempotent (scripts/apply-security-schema.js).
 */
export class ContentPhotoUploadFrame1790240000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('content_photos'))) return;
    await queryRunner.query(
      "ALTER TABLE `content_photos` MODIFY `source_type` ENUM('patient_photo', 'supporting_exam_image', 'upload') NOT NULL",
    );
    await queryRunner.query(
      'ALTER TABLE `content_photos` MODIFY `source_id` INT NULL',
    );
    if (!(await queryRunner.hasColumn('content_photos', 'file_url'))) {
      await queryRunner.query(
        'ALTER TABLE `content_photos` ADD `file_url` VARCHAR(500) NULL',
      );
    }
    if (!(await queryRunner.hasColumn('content_photos', 'frame'))) {
      await queryRunner.query(
        'ALTER TABLE `content_photos` ADD `frame` JSON NULL',
      );
    }
  }

  async down(): Promise<void> {
    // Tidak dibalik: baris 'upload' akan hilang maknanya.
  }
}
