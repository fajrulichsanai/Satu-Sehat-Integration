import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Folder & template foto klinis (PRD: Template Foto Pasien & Manajemen
 * Konten — Behel jadi contoh default, bukan satu-satunya kasus):
 * - photo_template_groups: folder (bawaan sistem "Behel", clinic_id NULL,
 *   atau folder buatan klinik sendiri).
 * - photo_templates: slot foto di dalam satu folder.
 * - patient_photos: foto klinis per pasien/kontrol, terikat slot (opsional).
 * - patients.photo_consent_marketing: izin pakai foto pasien itu untuk
 *   konten promosi (null = belum diputuskan), per pasien, bukan per foto.
 * - clinic_contents.layout: tambah 'series' untuk >2 foto.
 * - content_photos: foto-foto satu konten `series`, menunjuk ke
 *   patient_photos ATAU supporting_exam_images (tidak menyalin file).
 * Idempotent (scripts/apply-security-schema.js).
 */
export class ClinicalPhotoFolders1790230000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const add = async (table: string, column: string, ddl: string) => {
      if (
        (await queryRunner.hasTable(table)) &&
        !(await queryRunner.hasColumn(table, column))
      ) {
        await queryRunner.query(`ALTER TABLE \`${table}\` ADD ${ddl}`);
      }
    };

    if (!(await queryRunner.hasTable('photo_template_groups'))) {
      await queryRunner.query(`
        CREATE TABLE \`photo_template_groups\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NULL,
          \`name\` VARCHAR(100) NOT NULL,
          \`sort_order\` INT NOT NULL DEFAULT 0,
          \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          \`created_by\` INT NULL,
          \`updated_by\` INT NULL,
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_photo_template_groups_clinic\` (\`clinic_id\`),
          CONSTRAINT \`FK_photo_template_groups_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (!(await queryRunner.hasTable('photo_templates'))) {
      await queryRunner.query(`
        CREATE TABLE \`photo_templates\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`group_id\` INT NOT NULL,
          \`name\` VARCHAR(100) NOT NULL,
          \`sort_order\` INT NOT NULL DEFAULT 0,
          \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          \`created_by\` INT NULL,
          \`updated_by\` INT NULL,
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_photo_templates_group\` (\`group_id\`),
          CONSTRAINT \`FK_photo_templates_group\` FOREIGN KEY (\`group_id\`) REFERENCES \`photo_template_groups\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    // Klinik tidak bisa menghapus folder bawaan sistem (clinic_id NULL),
    // tapi boleh menonaktifkannya untuk klinik itu sendiri — baris di sini
    // berarti "nonaktif untuk clinic_id ini", tidak menyentuh klinik lain.
    if (!(await queryRunner.hasTable('clinic_disabled_photo_groups'))) {
      await queryRunner.query(`
        CREATE TABLE \`clinic_disabled_photo_groups\` (
          \`clinic_id\` INT NOT NULL,
          \`group_id\` INT NOT NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`clinic_id\`, \`group_id\`),
          CONSTRAINT \`FK_clinic_disabled_photo_groups_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\` (\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`FK_clinic_disabled_photo_groups_group\` FOREIGN KEY (\`group_id\`) REFERENCES \`photo_template_groups\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (!(await queryRunner.hasTable('patient_photos'))) {
      await queryRunner.query(`
        CREATE TABLE \`patient_photos\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`patient_id\` INT NOT NULL,
          \`encounter_id\` INT NOT NULL,
          \`template_id\` INT NULL,
          \`file_url\` VARCHAR(500) NOT NULL,
          \`original_name\` VARCHAR(255) NULL,
          \`taken_at\` DATETIME NOT NULL,
          \`taken_by\` INT NULL,
          \`original_size_bytes\` INT NULL,
          \`compressed_size_bytes\` INT NULL,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_patient_photos_patient\` (\`patient_id\`),
          INDEX \`IDX_patient_photos_encounter\` (\`encounter_id\`),
          CONSTRAINT \`FK_patient_photos_patient\` FOREIGN KEY (\`patient_id\`) REFERENCES \`patients\` (\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`FK_patient_photos_encounter\` FOREIGN KEY (\`encounter_id\`) REFERENCES \`encounters\` (\`id\`) ON DELETE CASCADE,
          CONSTRAINT \`FK_patient_photos_template\` FOREIGN KEY (\`template_id\`) REFERENCES \`photo_templates\` (\`id\`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    await add(
      'patients',
      'photo_consent_marketing',
      '`photo_consent_marketing` TINYINT(1) NULL',
    );
    await add(
      'patients',
      'photo_consent_updated_at',
      '`photo_consent_updated_at` DATETIME NULL',
    );
    await add(
      'patients',
      'photo_consent_updated_by',
      '`photo_consent_updated_by` INT NULL',
    );

    if (await queryRunner.hasTable('clinic_contents')) {
      const columns = await queryRunner.query(
        "SHOW COLUMNS FROM `clinic_contents` WHERE Field = 'layout'",
      );
      if (columns.length && !String(columns[0].Type).includes('series')) {
        await queryRunner.query(
          "ALTER TABLE `clinic_contents` MODIFY `layout` ENUM('stack', 'split', 'series') NOT NULL DEFAULT 'stack'",
        );
      }
    }

    if (!(await queryRunner.hasTable('content_photos'))) {
      await queryRunner.query(`
        CREATE TABLE \`content_photos\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`content_id\` INT NOT NULL,
          \`source_type\` ENUM('patient_photo', 'supporting_exam_image') NOT NULL,
          \`source_id\` INT NOT NULL,
          \`sort_order\` INT NOT NULL DEFAULT 0,
          \`caption\` VARCHAR(160) NULL,
          \`blur_face\` TINYINT(1) NOT NULL DEFAULT 0,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_content_photos_content\` (\`content_id\`),
          CONSTRAINT \`FK_content_photos_content\` FOREIGN KEY (\`content_id\`) REFERENCES \`clinic_contents\` (\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    // Folder bawaan sistem: "Behel" (clinic_id NULL) + 9 slot bawaan.
    const existingBehel = await queryRunner.query(
      "SELECT id FROM `photo_template_groups` WHERE `clinic_id` IS NULL AND `name` = 'Behel' LIMIT 1",
    );
    let behelGroupId: number;
    if (existingBehel.length === 0) {
      const result = await queryRunner.query(
        "INSERT INTO `photo_template_groups` (`clinic_id`, `name`, `sort_order`, `is_active`) VALUES (NULL, 'Behel', 0, 1)",
      );
      behelGroupId = result.insertId;
    } else {
      behelGroupId = existingBehel[0].id;
    }

    const [{ cnt }] = await queryRunner.query(
      'SELECT COUNT(*) AS cnt FROM `photo_templates` WHERE `group_id` = ?',
      [behelGroupId],
    );
    if (Number(cnt) === 0) {
      const slots = [
        'Rahang atas',
        'Rahang bawah',
        'Molar kanan',
        'Molar kiri',
        'Depan tidak senyum',
        'Depan senyum',
        'Foto profil',
        'Foto profil samping',
        'Lain-lain',
      ];
      for (let i = 0; i < slots.length; i++) {
        await queryRunner.query(
          'INSERT INTO `photo_templates` (`group_id`, `name`, `sort_order`, `is_active`) VALUES (?, ?, ?, 1)',
          [behelGroupId, slots[i], i],
        );
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('content_photos')) {
      await queryRunner.query('DROP TABLE `content_photos`');
    }
    if (await queryRunner.hasTable('clinic_contents')) {
      await queryRunner.query(
        "ALTER TABLE `clinic_contents` MODIFY `layout` ENUM('stack', 'split') NOT NULL DEFAULT 'stack'",
      );
    }
    for (const [table, column] of [
      ['patients', 'photo_consent_updated_by'],
      ['patients', 'photo_consent_updated_at'],
      ['patients', 'photo_consent_marketing'],
    ]) {
      if (
        (await queryRunner.hasTable(table)) &&
        (await queryRunner.hasColumn(table, column))
      ) {
        await queryRunner.query(
          `ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``,
        );
      }
    }
    if (await queryRunner.hasTable('patient_photos')) {
      await queryRunner.query('DROP TABLE `patient_photos`');
    }
    if (await queryRunner.hasTable('clinic_disabled_photo_groups')) {
      await queryRunner.query('DROP TABLE `clinic_disabled_photo_groups`');
    }
    if (await queryRunner.hasTable('photo_templates')) {
      await queryRunner.query('DROP TABLE `photo_templates`');
    }
    if (await queryRunner.hasTable('photo_template_groups')) {
      await queryRunner.query('DROP TABLE `photo_template_groups`');
    }
  }
}
