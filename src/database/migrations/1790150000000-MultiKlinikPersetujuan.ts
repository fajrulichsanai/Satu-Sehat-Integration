import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

/**
 * Multi-Klinik (PRD Multi-Klinik Owner): hubungan owner ↔ klinik kini lewat
 * persetujuan owner klinik, satu klinik hanya boleh punya satu owner
 * multiklinik, dan tiap cabang punya cara bayar (ditanggung owner / bayar
 * sendiri / berhenti).
 *
 * Hubungan yang sudah ada sebelum migrasi ini dibuat langsung oleh Super
 * Admin, jadi dianggap sudah disetujui. Bila satu klinik terlanjur terhubung
 * ke lebih dari satu owner, hanya hubungan tertua yang dipertahankan.
 * Idempotent (scripts/apply-security-schema.js).
 */
export class MultiKlinikPersetujuan1790150000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    const table = 'owner_clinic_links';
    if (!(await queryRunner.hasTable(table))) return;

    const columns: TableColumn[] = [
      new TableColumn({
        name: 'status',
        type: 'varchar',
        length: '12',
        default: "'approved'",
      }),
      new TableColumn({
        name: 'requested_at',
        type: 'datetime',
        isNullable: true,
      }),
      new TableColumn({ name: 'requested_by', type: 'int', isNullable: true }),
      new TableColumn({
        name: 'responded_at',
        type: 'datetime',
        isNullable: true,
      }),
      new TableColumn({ name: 'responded_by', type: 'int', isNullable: true }),
      new TableColumn({
        name: 'billing_mode',
        type: 'varchar',
        length: '10',
        default: "'owner'",
      }),
    ];
    for (const column of columns) {
      if (!(await queryRunner.hasColumn(table, column.name))) {
        await queryRunner.addColumn(table, column);
      }
    }

    // Satu klinik, satu owner multiklinik: buang duplikat (sisakan yang tertua).
    await queryRunner.query(`
      DELETE l FROM \`owner_clinic_links\` l
      JOIN \`owner_clinic_links\` older
        ON older.clinic_id = l.clinic_id AND older.id < l.id
    `);

    const current = await queryRunner.getTable(table);
    const hasIndex = (name: string) =>
      current?.indices.some((i) => i.name === name) ?? false;
    if (!hasIndex('UQ_owner_clinic_links_clinic')) {
      await queryRunner.createIndex(
        table,
        new TableIndex({
          name: 'UQ_owner_clinic_links_clinic',
          columnNames: ['clinic_id'],
          isUnique: true,
        }),
      );
    }
    if (!hasIndex('IDX_owner_clinic_links_status')) {
      await queryRunner.createIndex(
        table,
        new TableIndex({
          name: 'IDX_owner_clinic_links_status',
          columnNames: ['status', 'requested_at'],
        }),
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = 'owner_clinic_links';
    for (const index of [
      'IDX_owner_clinic_links_status',
      'UQ_owner_clinic_links_clinic',
    ]) {
      const current = await queryRunner.getTable(table);
      if (current?.indices.some((i) => i.name === index)) {
        await queryRunner.dropIndex(table, index);
      }
    }
    for (const column of [
      'billing_mode',
      'responded_by',
      'responded_at',
      'requested_by',
      'requested_at',
      'status',
    ]) {
      if (await queryRunner.hasColumn(table, column)) {
        await queryRunner.dropColumn(table, column);
      }
    }
  }
}
