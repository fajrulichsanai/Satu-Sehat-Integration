import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Follow Up Pasien: jenis kontrol (kunjungan / behel / saluran_akar /
 * perawatan). Recall lama diberi jenis dari nama tindakannya. Idempotent
 * (scripts/apply-security-schema.js).
 */
export class RecallKind1790260000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('patient_recalls'))) return;
    if (!(await queryRunner.hasColumn('patient_recalls', 'kind'))) {
      await queryRunner.query(
        "ALTER TABLE `patient_recalls` ADD `kind` VARCHAR(24) NOT NULL DEFAULT 'perawatan'",
      );
      if (await queryRunner.hasTable('tarifs')) {
        await queryRunner.query(`
          UPDATE patient_recalls r JOIN tarifs t ON t.id = r.tarif_id
          SET r.kind = CASE
            WHEN LOWER(CONCAT(t.name, ' ', t.kategori)) REGEXP 'behel|bracket|kawat gigi|ortodon|ortho|aligner' THEN 'behel'
            WHEN LOWER(CONCAT(t.name, ' ', t.kategori)) REGEXP 'saluran akar|(^| )psa( |$)|pulpektomi|pulpotomi|endodon' THEN 'saluran_akar'
            ELSE 'perawatan' END
        `);
      }
    }
  }

  async down(): Promise<void> {
    // Kolom dibiarkan.
  }
}
