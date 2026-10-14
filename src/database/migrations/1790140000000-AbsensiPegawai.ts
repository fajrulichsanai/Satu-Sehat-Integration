import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Absensi pegawai: catatan absen harian, perangkat absen, jadwal kerja, dan
 * pengaturan per klinik. Foto selfie dan koordinat persis tidak punya kolom —
 * keduanya memang tidak disimpan.
 * Idempotent (scripts/apply-security-schema.js).
 */
export class AbsensiPegawai1790140000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const audit = `
      \`created_by\` INT NULL,
      \`updated_by\` INT NULL,
      \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)`;
    const clinicFk = (name: string) =>
      `CONSTRAINT \`FK_${name}_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE`;
    const side = (p: 'in' | 'out') => `
          \`clock_${p}_at\` DATETIME NULL,
          \`clock_${p}_location\` VARCHAR(15) NULL,
          \`clock_${p}_distance_m\` INT NULL,
          \`clock_${p}_accuracy_m\` INT NULL,
          \`clock_${p}_device_id\` INT NULL,
          \`clock_${p}_device_status\` VARCHAR(12) NULL,`;

    if (!(await queryRunner.hasTable('attendance_records'))) {
      await queryRunner.query(`
        CREATE TABLE \`attendance_records\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`user_id\` INT NOT NULL,
          \`work_date\` DATE NOT NULL,
          \`schedule_mode\` VARCHAR(10) NOT NULL,
          \`scheduled_start\` VARCHAR(5) NULL,
          \`scheduled_end\` VARCHAR(5) NULL,${side('in')}${side('out')}
          \`original_clock_in_at\` DATETIME NULL,
          \`original_clock_out_at\` DATETIME NULL,
          \`corrected_by\` INT NULL,
          \`corrected_at\` DATETIME NULL,
          \`correction_reason\` VARCHAR(255) NULL,
          ${audit},
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`UQ_attendance_records_day\` (\`clinic_id\`, \`user_id\`, \`work_date\`),
          INDEX \`IDX_attendance_records_date\` (\`clinic_id\`, \`work_date\`),
          ${clinicFk('attendance_records')},
          CONSTRAINT \`FK_attendance_records_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }

    if (!(await queryRunner.hasTable('attendance_devices'))) {
      await queryRunner.query(`
        CREATE TABLE \`attendance_devices\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`user_id\` INT NULL,
          \`token_hash\` CHAR(64) NOT NULL,
          \`name\` VARCHAR(100) NOT NULL,
          \`is_registered\` TINYINT NOT NULL DEFAULT 0,
          \`is_clinic_device\` TINYINT NOT NULL DEFAULT 0,
          \`last_used_at\` DATETIME NULL,
          ${audit},
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_attendance_devices_token\` (\`clinic_id\`, \`token_hash\`),
          INDEX \`IDX_attendance_devices_user\` (\`clinic_id\`, \`user_id\`),
          ${clinicFk('attendance_devices')},
          CONSTRAINT \`FK_attendance_devices_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }

    if (!(await queryRunner.hasTable('work_schedules'))) {
      await queryRunner.query(`
        CREATE TABLE \`work_schedules\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`user_id\` INT NULL,
          \`day_of_week\` TINYINT NOT NULL,
          \`mode\` VARCHAR(10) NOT NULL,
          \`start_time\` VARCHAR(5) NULL,
          \`end_time\` VARCHAR(5) NULL,
          ${audit},
          PRIMARY KEY (\`id\`),
          INDEX \`IDX_work_schedules_owner\` (\`clinic_id\`, \`user_id\`),
          ${clinicFk('work_schedules')},
          CONSTRAINT \`FK_work_schedules_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }

    if (!(await queryRunner.hasTable('attendance_settings'))) {
      await queryRunner.query(`
        CREATE TABLE \`attendance_settings\` (
          \`id\` INT NOT NULL AUTO_INCREMENT,
          \`clinic_id\` INT NOT NULL,
          \`tolerance_minutes\` INT NOT NULL DEFAULT 10,
          \`radius_m\` INT NOT NULL DEFAULT 100,
          \`latitude\` DECIMAL(10,7) NULL,
          \`longitude\` DECIMAL(10,7) NULL,
          ${audit},
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`UQ_attendance_settings_clinic\` (\`clinic_id\`),
          ${clinicFk('attendance_settings')}
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `attendance_settings`');
    await queryRunner.query('DROP TABLE IF EXISTS `work_schedules`');
    await queryRunner.query('DROP TABLE IF EXISTS `attendance_devices`');
    await queryRunner.query('DROP TABLE IF EXISTS `attendance_records`');
  }
}
