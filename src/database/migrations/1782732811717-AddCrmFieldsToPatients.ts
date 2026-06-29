import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCrmFieldsToPatients1782732811717 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `patients` ADD `nama_wali` VARCHAR(100) NULL');
    await queryRunner.query(
      "ALTER TABLE `patients` ADD `hubungan_wali` ENUM('ibu','ayah','wali') NULL",
    );
    await queryRunner.query('ALTER TABLE `patients` ADD `pekerjaan` VARCHAR(100) NULL');
    await queryRunner.query('ALTER TABLE `patients` ADD `kelurahan` VARCHAR(100) NULL');
    await queryRunner.query('ALTER TABLE `patients` ADD `kecamatan` VARCHAR(100) NULL');

    await queryRunner.query(
      "ALTER TABLE `patients` ADD `sumber_informasi` ENUM('instagram','tiktok','google_maps','facebook','teman_keluarga','lewat_depan_klinik','brosur','lainnya') NULL",
    );
    await queryRunner.query('ALTER TABLE `patients` ADD `detail_sumber` VARCHAR(200) NULL');
    await queryRunner.query('ALTER TABLE `patients` ADD `kode_referral` VARCHAR(50) NULL');
    await queryRunner.query('ALTER TABLE `patients` ADD `referrer_patient_id` INT NULL');

    await queryRunner.query(
      "ALTER TABLE `patients` ADD `golongan_darah` ENUM('A','B','AB','O') NULL",
    );
    await queryRunner.query(
      "ALTER TABLE `patients` ADD `rhesus` ENUM('positive','negative') NULL",
    );
    await queryRunner.query(
      'ALTER TABLE `patients` ADD `punya_alergi` TINYINT NOT NULL DEFAULT 0',
    );
    await queryRunner.query('ALTER TABLE `patients` ADD `catatan_alergi` TEXT NULL');

    await queryRunner.query(
      "ALTER TABLE `patients` ADD `preferensi_kontak` ENUM('whatsapp','telepon','email') NULL",
    );
    await queryRunner.query(
      "ALTER TABLE `patients` ADD `preferensi_jam_kontak` ENUM('pagi','siang','sore','malam') NULL",
    );
    await queryRunner.query('ALTER TABLE `patients` ADD `catatan_preferensi` TEXT NULL');
    await queryRunner.query(
      'ALTER TABLE `patients` ADD `is_member` TINYINT NOT NULL DEFAULT 0',
    );
    await queryRunner.query('ALTER TABLE `patients` ADD `member_id` VARCHAR(50) NULL');

    await queryRunner.query(
      'ALTER TABLE `patients` ADD `consent_marketing` TINYINT NOT NULL DEFAULT 0',
    );
    await queryRunner.query('ALTER TABLE `patients` ADD `consent_tanggal` DATETIME NULL');
    await queryRunner.query('ALTER TABLE `patients` ADD `consent_version` VARCHAR(20) NULL');
    await queryRunner.query(
      'ALTER TABLE `patients` ADD `status_aktif` TINYINT NOT NULL DEFAULT 1',
    );

    await queryRunner.query(
      'ALTER TABLE `patients` ADD CONSTRAINT `FK_patients_referrer` FOREIGN KEY (`referrer_patient_id`) REFERENCES `patients`(`id`) ON DELETE SET NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `patients` DROP FOREIGN KEY `FK_patients_referrer`');

    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `status_aktif`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `consent_version`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `consent_tanggal`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `consent_marketing`');

    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `member_id`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `is_member`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `catatan_preferensi`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `preferensi_jam_kontak`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `preferensi_kontak`');

    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `catatan_alergi`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `punya_alergi`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `rhesus`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `golongan_darah`');

    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `referrer_patient_id`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `kode_referral`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `detail_sumber`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `sumber_informasi`');

    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `kecamatan`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `kelurahan`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `pekerjaan`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `hubungan_wali`');
    await queryRunner.query('ALTER TABLE `patients` DROP COLUMN `nama_wali`');
  }
}
