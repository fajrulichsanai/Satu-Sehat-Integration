import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { toCsv } from './csv';

export interface AdminNote {
  id: number;
  body: string;
  followUpOn: string | null;
  doneAt: Date | null;
  createdByName: string | null;
  createdAt: Date;
}

const EXPORT_LIMIT = 10_000;

/**
 * Alat bantu Super Admin: catatan internal per klinik (PIC, WhatsApp, tindak
 * lanjut — PRD UP-06) dan ekspor CSV daftar klinik, pembayaran, dan log
 * aktivitas (UP-08).
 */
@Injectable()
export class SuperAdminToolsService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  private async assertClinic(clinicId: number) {
    const [row] = (await this.db.query('SELECT id FROM clinics WHERE id = ?', [
      clinicId,
    ])) as { id: number }[];
    if (!row) throw new NotFoundException('Klinik tidak ditemukan');
  }

  async notes(clinicId: number) {
    await this.assertClinic(clinicId);
    const [pic] = (await this.db.query(
      'SELECT admin_pic_name AS name, admin_pic_phone AS phone FROM clinics WHERE id = ?',
      [clinicId],
    )) as { name: string | null; phone: string | null }[];
    const notes = (await this.db.query(
      `SELECT id, body, DATE_FORMAT(follow_up_on, '%Y-%m-%d') AS followUpOn, done_at AS doneAt,
              created_by_name AS createdByName, created_at AS createdAt
         FROM clinic_admin_notes WHERE clinic_id = ? ORDER BY created_at DESC, id DESC`,
      [clinicId],
    )) as AdminNote[];
    return {
      pic: { name: pic?.name ?? null, phone: pic?.phone ?? null },
      notes: notes.map((n) => ({ ...n, id: Number(n.id) })),
    };
  }

  async setPic(clinicId: number, name: string | null, phone: string | null) {
    await this.assertClinic(clinicId);
    const cleanPhone = phone?.replace(/[^\d+]/g, '') || null;
    await this.db.query(
      'UPDATE clinics SET admin_pic_name = ?, admin_pic_phone = ? WHERE id = ?',
      [name?.trim() || null, cleanPhone, clinicId],
    );
    return this.notes(clinicId);
  }

  async addNote(
    clinicId: number,
    body: string,
    followUpOn: string | null,
    by: { id: number; name: string },
  ) {
    await this.assertClinic(clinicId);
    if (!body.trim())
      throw new BadRequestException('Catatan tidak boleh kosong');
    await this.db.query(
      'INSERT INTO clinic_admin_notes (clinic_id, body, follow_up_on, created_by, created_by_name) VALUES (?, ?, ?, ?, ?)',
      [clinicId, body.trim(), followUpOn || null, by.id, by.name],
    );
    return this.notes(clinicId);
  }

  async setNoteDone(clinicId: number, noteId: number, done: boolean) {
    const res = (await this.db.query(
      'UPDATE clinic_admin_notes SET done_at = ? WHERE id = ? AND clinic_id = ?',
      [done ? new Date() : null, noteId, clinicId],
    )) as { affectedRows?: number };
    if (!res?.affectedRows)
      throw new NotFoundException('Catatan tidak ditemukan');
    return this.notes(clinicId);
  }

  async deleteNote(clinicId: number, noteId: number) {
    const res = (await this.db.query(
      'DELETE FROM clinic_admin_notes WHERE id = ? AND clinic_id = ?',
      [noteId, clinicId],
    )) as { affectedRows?: number };
    if (!res?.affectedRows)
      throw new NotFoundException('Catatan tidak ditemukan');
    return this.notes(clinicId);
  }

  /** Tindak lanjut yang jatuh tempo (≤ hari ini) dan belum selesai — untuk Dashboard. */
  async dueFollowUps(today: string) {
    const rows = (await this.db.query(
      `SELECT n.id, n.clinic_id AS clinicId, c.name AS clinicName, n.body,
              DATE_FORMAT(n.follow_up_on, '%Y-%m-%d') AS followUpOn
         FROM clinic_admin_notes n JOIN clinics c ON c.id = n.clinic_id
        WHERE n.done_at IS NULL AND n.follow_up_on IS NOT NULL AND n.follow_up_on <= ?
        ORDER BY n.follow_up_on ASC LIMIT 50`,
      [today],
    )) as {
      id: number;
      clinicId: number;
      clinicName: string;
      body: string;
      followUpOn: string;
    }[];
    return rows.map((r) => ({
      ...r,
      id: Number(r.id),
      clinicId: Number(r.clinicId),
    }));
  }

  async clinicsCsv(): Promise<string> {
    const rows = (await this.db.query(
      `SELECT c.id, c.name, c.city, c.province,
              (SELECT u.name FROM users u WHERE u.clinic_id = c.id AND u.role = 'owner' ORDER BY u.is_active DESC, u.id LIMIT 1) AS ownerName,
              (SELECT u.email FROM users u WHERE u.clinic_id = c.id AND u.role = 'owner' ORDER BY u.is_active DESC, u.id LIMIT 1) AS ownerEmail,
              c.admin_pic_name AS picName, c.admin_pic_phone AS picPhone,
              p.name AS planName, s.status, DATE_FORMAT(s.end_date, '%Y-%m-%d') AS endDate,
              (SELECT COUNT(*) FROM users u WHERE u.clinic_id = c.id AND u.is_active = 1) AS activeUsers,
              (SELECT MAX(u.last_login_at) FROM users u WHERE u.clinic_id = c.id) AS lastLoginAt,
              (SELECT COUNT(*) FROM encounters e WHERE e.clinic_id = c.id AND e.created_at >= NOW() - INTERVAL 30 DAY) AS visits30,
              DATE_FORMAT(c.created_at, '%Y-%m-%d') AS createdAt,
              DATE_FORMAT(c.data_delete_after, '%Y-%m-%d') AS dataDeleteAfter,
              c.data_purged_at AS dataPurgedAt
         FROM clinics c
         LEFT JOIN clinic_subscriptions s ON s.id = (
           SELECT s2.id FROM clinic_subscriptions s2 WHERE s2.clinic_id = c.id ORDER BY s2.end_date DESC, s2.id DESC LIMIT 1)
         LEFT JOIN subscription_plans p ON p.id = s.plan_id
        ORDER BY c.name ASC LIMIT ${EXPORT_LIMIT}`,
    )) as Record<string, unknown>[];
    return toCsv(
      [
        'ID',
        'Klinik',
        'Kota',
        'Provinsi',
        'Owner',
        'Email owner',
        'PIC',
        'WhatsApp PIC',
        'Paket',
        'Status',
        'Berakhir',
        'Akun aktif',
        'Login terakhir',
        'Kunjungan 30 hari',
        'Terdaftar',
        'Data dihapus setelah',
        'Data dihapus pada',
      ],
      rows.map((r) => [
        r.id,
        r.name,
        r.city,
        r.province,
        r.ownerName,
        r.ownerEmail,
        r.picName,
        r.picPhone,
        r.planName,
        r.status,
        r.endDate,
        r.activeUsers,
        r.lastLoginAt,
        r.visits30,
        r.createdAt,
        r.dataDeleteAfter,
        r.dataPurgedAt,
      ]),
    );
  }

  async paymentsCsv(status?: string): Promise<string> {
    const where = status ? 'WHERE p.status = ?' : '';
    const rows = (await this.db.query(
      `SELECT p.id, p.created_at AS createdAt, p.status, p.kind,
              COALESCE(c.name, CONCAT(o.name, ' (Multi-Klinik)')) AS payer, pl.name AS planName,
              p.quantity, p.months, p.amount, p.promo_discount AS promoDiscount,
              p.duration_discount AS durationDiscount, p.extra_storage_gb AS extraStorageGb,
              p.storage_amount AS storageAmount, p.confirmed_at AS confirmedAt, p.notes
         FROM subscription_payments p
         LEFT JOIN clinics c ON c.id = p.clinic_id
         LEFT JOIN users o ON o.id = p.owner_id
         LEFT JOIN subscription_plans pl ON pl.id = p.plan_id
         ${where}
        ORDER BY p.created_at DESC LIMIT ${EXPORT_LIMIT}`,
      status ? [status] : [],
    )) as Record<string, unknown>[];
    return toCsv(
      [
        'No. kuitansi',
        'Diajukan',
        'Status',
        'Jenis',
        'Pembayar',
        'Paket',
        'Jumlah klinik',
        'Bulan',
        'Jumlah (Rp)',
        'Potongan promo',
        'Diskon lama langganan',
        'Storage tambahan (GB)',
        'Biaya storage',
        'Dikonfirmasi',
        'Catatan',
      ],
      rows.map((r) => [
        `APX-${String(r.id).padStart(6, '0')}`,
        r.createdAt,
        r.status,
        r.kind === 'upgrade' ? 'Naik paket' : 'Beli/perpanjang',
        r.payer,
        r.planName,
        r.quantity,
        r.months,
        r.amount,
        r.promoDiscount,
        r.durationDiscount,
        r.extraStorageGb,
        r.storageAmount,
        r.confirmedAt,
        r.notes,
      ]),
    );
  }

  async auditCsv(q: {
    clinicId?: number;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<string> {
    const cond: string[] = [];
    const params: unknown[] = [];
    if (q.clinicId) {
      cond.push('a.clinic_id = ?');
      params.push(q.clinicId);
    }
    if (q.dateFrom) {
      cond.push('a.created_at >= ?');
      params.push(q.dateFrom);
    }
    if (q.dateTo) {
      cond.push('a.created_at < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(q.dateTo);
    }
    const rows = (await this.db.query(
      `SELECT a.created_at AS createdAt, c.name AS clinicName, a.actor_name AS actorName, a.actor_role AS actorRole,
              a.action_type AS actionType, a.entity_type AS entityType, a.entity_label AS entityLabel,
              a.status, a.ip_address AS ip
         FROM audit_logs a LEFT JOIN clinics c ON c.id = a.clinic_id
        ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''}
        ORDER BY a.created_at DESC LIMIT ${EXPORT_LIMIT}`,
      params,
    )) as Record<string, unknown>[];
    return toCsv(
      [
        'Waktu',
        'Klinik',
        'Pengguna',
        'Peran',
        'Aksi',
        'Data',
        'Keterangan',
        'Status',
        'IP',
      ],
      rows.map((r) => [
        r.createdAt,
        r.clinicName,
        r.actorName,
        r.actorRole,
        r.actionType,
        r.entityType,
        r.entityLabel,
        r.status,
        r.ip,
      ]),
    );
  }
}
