import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * satusehat_sync_logs kept the full FHIR request/response bodies (patient
 * NIK, name, clinical data). A transaction log must not hold sensitive data
 * (SATUSEHAT self-assessment No. 15), so the columns — and the data already
 * in them — are dropped. `down` restores empty columns only; the removed
 * payloads are not recoverable, by design.
 */
export class DropSyncLogPayloads1789910000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotent: DB_SYNCHRONIZE may already have dropped them.
    for (const column of ['request_payload', 'response_payload']) {
      if (await queryRunner.hasColumn('satusehat_sync_logs', column)) {
        await queryRunner.query(
          `ALTER TABLE \`satusehat_sync_logs\` DROP COLUMN \`${column}\``,
        );
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`satusehat_sync_logs\`
        ADD COLUMN \`request_payload\` JSON NULL,
        ADD COLUMN \`response_payload\` JSON NULL
    `);
  }
}
