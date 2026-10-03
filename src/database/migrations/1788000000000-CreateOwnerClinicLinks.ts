import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOwnerClinicLinks1788000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`owner_clinic_links\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`created_by\` INT NULL,
        \`updated_by\` INT NULL,
        \`owner_id\` INT NOT NULL,
        \`clinic_id\` INT NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`IDX_owner_clinic_links_owner_clinic\` (\`owner_id\`, \`clinic_id\`),
        INDEX \`IDX_owner_clinic_links_owner_id\` (\`owner_id\`),
        INDEX \`IDX_owner_clinic_links_clinic_id\` (\`clinic_id\`),
        CONSTRAINT \`FK_owner_clinic_links_owner\` FOREIGN KEY (\`owner_id\`)
          REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_owner_clinic_links_clinic\` FOREIGN KEY (\`clinic_id\`)
          REFERENCES \`clinics\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `owner_clinic_links`');
  }
}
