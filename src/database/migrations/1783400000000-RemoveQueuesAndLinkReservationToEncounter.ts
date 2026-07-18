import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveQueuesAndLinkReservationToEncounter1783400000000
  implements MigrationInterface
{
  async up(queryRunner: QueryRunner): Promise<void> {
    const encounterQueueFk = await this.findForeignKeyName(
      queryRunner,
      'encounters',
      'queue_id',
    );
    if (encounterQueueFk) {
      await queryRunner.query(
        `ALTER TABLE \`encounters\` DROP FOREIGN KEY \`${encounterQueueFk}\``,
      );
    }
    await queryRunner.query(
      'ALTER TABLE `encounters` DROP COLUMN `queue_id`',
    );

    await queryRunner.query('DROP TABLE IF EXISTS `queues`');

    await queryRunner.query(
      'ALTER TABLE `encounters` ADD `reservation_id` INT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `encounters` ADD CONSTRAINT `FK_encounters_reservation_id` ' +
        'FOREIGN KEY (`reservation_id`) REFERENCES `reservations`(`id`) ON DELETE SET NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE `encounters` DROP FOREIGN KEY `FK_encounters_reservation_id`',
    );
    await queryRunner.query(
      'ALTER TABLE `encounters` DROP COLUMN `reservation_id`',
    );

    await queryRunner.query(`
      CREATE TABLE \`queues\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        \`clinic_id\` INT NOT NULL,
        \`patient_id\` INT NULL,
        \`practitioner_id\` INT NOT NULL,
        \`nomor_antrian\` VARCHAR(20) NOT NULL,
        \`tanggal\` DATE NOT NULL,
        \`jam_slot\` TIME NULL,
        \`patient_name\` VARCHAR(100) NOT NULL,
        \`phone\` VARCHAR(20) NOT NULL,
        \`chief_complaint\` TEXT NULL,
        \`is_first_visit\` TINYINT NOT NULL DEFAULT 0,
        \`is_online_booking\` TINYINT NOT NULL DEFAULT 0,
        \`token\` VARCHAR(20) NOT NULL,
        \`status\` ENUM('waiting','confirmed','called','done','cancelled') NOT NULL DEFAULT 'waiting',
        \`cancelled_reason\` TEXT NULL,
        \`called_at\` DATETIME NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`IDX_queues_token\` (\`token\`),
        CONSTRAINT \`FK_queues_clinic\` FOREIGN KEY (\`clinic_id\`) REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_queues_patient\` FOREIGN KEY (\`patient_id\`) REFERENCES \`patients\`(\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`FK_queues_practitioner\` FOREIGN KEY (\`practitioner_id\`) REFERENCES \`practitioners\`(\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(
      'ALTER TABLE `encounters` ADD `queue_id` INT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `encounters` ADD CONSTRAINT `FK_encounters_queue_id` ' +
        'FOREIGN KEY (`queue_id`) REFERENCES `queues`(`id`) ON DELETE SET NULL',
    );
  }

  private async findForeignKeyName(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<string | undefined> {
    const rows: Array<{ CONSTRAINT_NAME: string }> = await queryRunner.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = ?
         AND COLUMN_NAME = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [tableName, columnName],
    );
    return rows[0]?.CONSTRAINT_NAME;
  }
}
