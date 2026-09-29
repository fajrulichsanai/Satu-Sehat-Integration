import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rp 0 bills (free consultation, follow-up visit already paid for) used to
 * be created as 'unpaid' and stayed 'Belum Bayar'. New ones are created as
 * paid; this settles the existing ones. Idempotent — safe on every deploy.
 */
export class SettleZeroBillings1789950000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE billings SET status = 'paid', outstanding_amount = 0
       WHERE status = 'unpaid' AND grand_total <= 0`,
    );
  }

  async down(): Promise<void> {
    // Data fix only; nothing to undo.
  }
}
