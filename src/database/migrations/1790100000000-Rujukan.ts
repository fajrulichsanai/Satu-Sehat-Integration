import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rujukan pasien (→ Task, ServiceRequest, CarePlan SATUSEHAT Rujukan).
 * Idempotent (scripts/apply-security-schema.js).
 */
export class Rujukan1790100000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('referrals')) return;
    await queryRunner.query(`
      CREATE TABLE \`referrals\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`created_by\` int NULL,
        \`updated_by\` int NULL,
        \`clinic_id\` int NOT NULL,
        \`encounter_id\` int NOT NULL,
        \`patient_id\` int NOT NULL,
        \`care_type\` varchar(20) NOT NULL,
        \`status\` varchar(20) NOT NULL DEFAULT 'draft',
        \`primary_diagnosis\` json NOT NULL,
        \`secondary_diagnoses\` json NULL,
        \`service_group\` json NOT NULL,
        \`specialty\` json NOT NULL,
        \`performer_type\` json NULL,
        \`reason\` text NOT NULL,
        \`patient_instruction\` text NULL,
        \`planned_date\` date NOT NULL,
        \`pcare_number\` varchar(50) NULL,
        \`target_org_id\` varchar(100) NULL,
        \`target_name\` varchar(255) NULL,
        \`pre_task_id\` varchar(100) NULL,
        \`questionnaires\` json NULL,
        \`criteria_answers\` json NULL,
        \`area\` json NULL,
        \`candidate_task_id\` varchar(100) NULL,
        \`candidates\` json NULL,
        \`service_request_id\` varchar(100) NULL,
        \`care_plan_id\` varchar(100) NULL,
        \`referral_number\` varchar(100) NULL,
        \`sent_at\` datetime NULL,
        \`last_error\` text NULL,
        INDEX \`IDX_referrals_clinic_encounter\` (\`clinic_id\`, \`encounter_id\`),
        INDEX \`IDX_referrals_clinic_patient\` (\`clinic_id\`, \`patient_id\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`FK_referrals_encounter\` FOREIGN KEY (\`encounter_id\`)
          REFERENCES \`encounters\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('referrals')) {
      await queryRunner.query('DROP TABLE `referrals`');
    }
  }
}
