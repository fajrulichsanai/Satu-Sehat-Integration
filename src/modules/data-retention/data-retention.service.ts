import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Resend } from 'resend';
import { randomBytes } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import { join, normalize, sep } from 'path';
import { S3StorageService } from '../../common/storage/s3-storage.service';
import { PlatformSettingsService } from '../features/platform-settings.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  AuditActionType,
  AuditStatus,
} from '../audit-log/entities/audit-log.entity';

export const DEFAULT_RETENTION_DAYS = 15;
const UPLOADS_DIR = join(process.cwd(), 'uploads');

/** YYYY-MM-DD in server-local time. */
export function isoDate(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function daysUntil(date: string, from: string = isoDate()): number {
  const a = new Date(`${date.slice(0, 10)}T00:00:00`).getTime();
  const b = new Date(`${from}T00:00:00`).getTime();
  return Math.round((a - b) / 86_400_000);
}

export function formatDateId(date: string): string {
  return new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Tabel anak tanpa clinic_id: dihapus lewat induknya, sebelum induknya. */
const CHILD_DELETES: string[] = [
  'DELETE FROM lab_results WHERE order_id IN (SELECT id FROM lab_orders WHERE encounter_id IN (SELECT id FROM encounters WHERE clinic_id = ?))',
  ...[
    'encounter_soap_notes',
    'prescription_signatures',
    'radiology_orders',
    'prescription_reviews',
    'lab_orders',
    'supporting_exam_images',
    'physical_examinations',
    'prescription_items',
    'dental_examinations',
  ].map(
    (t) =>
      `DELETE FROM ${t} WHERE encounter_id IN (SELECT id FROM encounters WHERE clinic_id = ?)`,
  ),
  'DELETE FROM treatment_plan_sessions WHERE treatment_plan_id IN (SELECT id FROM treatment_plans WHERE clinic_id = ?)',
  'DELETE FROM tooth_conditions WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ?)',
  'DELETE FROM dental_bridges WHERE patient_id IN (SELECT id FROM patients WHERE clinic_id = ?)',
  'DELETE FROM billing_items WHERE billing_id IN (SELECT id FROM billings WHERE clinic_id = ?)',
  'DELETE FROM payments WHERE billing_id IN (SELECT id FROM billings WHERE clinic_id = ?)',
];

/**
 * Tabel ber-clinic_id yang TIDAK dihapus: riwayat tagihan ApexRecord sendiri
 * (langganan, pembayaran, storage tambahan) dan permintaan data UU PDP.
 */
const KEEP_TABLES = new Set([
  'clinics',
  'users',
  'clinic_subscriptions',
  'subscription_payments',
  'storage_addons',
  'data_requests',
]);

export interface RetentionRow {
  clinicId: number;
  clinicName: string;
  lastEndDate: string | null;
  deleteAfter: string | null;
  daysLeft: number | null;
  purgedAt: Date | null;
}

/**
 * Klinik yang berhenti berlangganan: semua datanya bisa diunduh selama 15
 * hari setelah langganan berakhir (DATA_RETENTION_DAYS), lalu dihapus.
 * - Jadwal dibuat otomatis dan diberitahukan ke owner (email), dengan
 *   pengingat H-7 dan H-1. Memperpanjang langganan membatalkan jadwal.
 * - Penghapusan otomatis hanya berjalan bila saklar platform "Hapus otomatis"
 *   menyala; Super Admin juga bisa menghapus sendiri atau menunda.
 * - Yang dihapus: pasien, rekam medis, tagihan pasien, berkas, dll. Yang
 *   tetap: baris klinik (nama), riwayat langganan & pembayaran ke ApexRecord.
 *   Akun pengguna klinik dinonaktifkan dan dianonimkan.
 */
@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);
  private readonly resend: Resend;
  readonly retentionDays: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly storage: S3StorageService,
    private readonly platform: PlatformSettingsService,
    private readonly auditLog: AuditLogService,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    const days = Number(
      this.configService.get<string>(
        'DATA_RETENTION_DAYS',
        String(DEFAULT_RETENTION_DAYS),
      ),
    );
    this.retentionDays =
      Number.isFinite(days) && days >= 1
        ? Math.floor(days)
        : DEFAULT_RETENTION_DAYS;
  }

  /**
   * Klinik tanpa langganan aktif (tidak ada baris aktif yang berakhir hari
   * ini atau sesudahnya), beserta tanggal berakhir langganan terakhirnya.
   */
  async lapsedClinics(
    today = isoDate(),
  ): Promise<{ id: number; lastEnd: string }[]> {
    const rows = (await this.dataSource.query(
      `SELECT c.id AS id, DATE_FORMAT(MAX(cs.end_date), '%Y-%m-%d') AS lastEnd
         FROM clinics c
         JOIN clinic_subscriptions cs ON cs.clinic_id = c.id
        WHERE c.data_purged_at IS NULL
        GROUP BY c.id
       HAVING SUM(cs.status = 'active' AND cs.end_date >= ?) = 0
          AND MAX(cs.end_date) < ?`,
      [today, today],
    )) as { id: number; lastEnd: string }[];
    return rows.map((r) => ({ id: Number(r.id), lastEnd: r.lastEnd }));
  }

  /**
   * Buat jadwal hapus untuk klinik yang baru berhenti (dan beri tahu
   * owner-nya), batalkan jadwal klinik yang sudah berlangganan lagi.
   * Klinik yang sudah lama berhenti tetap mendapat 15 hari penuh sejak
   * jadwalnya dibuat.
   */
  async scheduleLapsed(today = isoDate()) {
    const lapsed = await this.lapsedClinics(today);
    const lapsedIds = new Set(lapsed.map((l) => l.id));
    let scheduled = 0;
    let cancelled = 0;

    const withSchedule = (await this.dataSource.query(
      'SELECT id FROM clinics WHERE data_delete_after IS NOT NULL AND data_purged_at IS NULL',
    )) as { id: number }[];
    for (const { id } of withSchedule) {
      if (!lapsedIds.has(Number(id))) {
        await this.clearSchedule(Number(id));
        cancelled += 1;
      }
    }

    const scheduledIds = new Set(withSchedule.map((r) => Number(r.id)));
    for (const { id, lastEnd } of lapsed) {
      if (scheduledIds.has(id)) continue;
      // Baru berhenti (cron harian menemukannya 1–3 hari kemudian): hitung
      // dari tanggal berakhir. Sudah lama berhenti sebelum fitur ini ada:
      // tetap dapat masa unduh penuh mulai hari ini.
      const fromEnd = addDays(lastEnd, this.retentionDays);
      const deleteAfter =
        daysUntil(fromEnd, today) >= this.retentionDays - 3
          ? fromEnd
          : addDays(today, this.retentionDays);
      await this.dataSource.query(
        'UPDATE clinics SET data_delete_after = ?, data_delete_h7_at = NULL, data_delete_h1_at = NULL WHERE id = ?',
        [deleteAfter, id],
      );
      scheduled += 1;
      void this.notify(id, deleteAfter, 'scheduled');
    }
    return { scheduled, cancelled };
  }

  async clearSchedule(clinicId: number) {
    await this.dataSource.query(
      'UPDATE clinics SET data_delete_after = NULL, data_delete_h7_at = NULL, data_delete_h1_at = NULL WHERE id = ?',
      [clinicId],
    );
  }

  async sendReminders(today = isoDate()) {
    const rows = (await this.dataSource.query(
      `SELECT id, DATE_FORMAT(data_delete_after, '%Y-%m-%d') AS deleteAfter,
              data_delete_h7_at AS h7, data_delete_h1_at AS h1
         FROM clinics
        WHERE data_delete_after IS NOT NULL AND data_purged_at IS NULL`,
    )) as {
      id: number;
      deleteAfter: string;
      h7: Date | null;
      h1: Date | null;
    }[];
    let sent = 0;
    for (const r of rows) {
      const left = daysUntil(r.deleteAfter, today);
      if (left <= 1 && left >= 0 && !r.h1) {
        await this.dataSource.query(
          'UPDATE clinics SET data_delete_h1_at = NOW(), data_delete_h7_at = COALESCE(data_delete_h7_at, NOW()) WHERE id = ?',
          [r.id],
        );
        void this.notify(Number(r.id), r.deleteAfter, 'h1');
        sent += 1;
      } else if (left <= 7 && left > 1 && !r.h7) {
        await this.dataSource.query(
          'UPDATE clinics SET data_delete_h7_at = NOW() WHERE id = ?',
          [r.id],
        );
        void this.notify(Number(r.id), r.deleteAfter, 'h7');
        sent += 1;
      }
    }
    return sent;
  }

  /** Klinik yang masa unduhnya sudah lewat (hari ini > tanggal unduh terakhir). */
  async dueClinics(today = isoDate()): Promise<number[]> {
    const rows = (await this.dataSource.query(
      'SELECT id FROM clinics WHERE data_delete_after IS NOT NULL AND data_delete_after < ? AND data_purged_at IS NULL',
      [today],
    )) as { id: number }[];
    const lapsed = new Set((await this.lapsedClinics(today)).map((l) => l.id));
    return rows.map((r) => Number(r.id)).filter((id) => lapsed.has(id));
  }

  async purgeDue(today = isoDate()) {
    if (!(await this.platform.isAutoPurgeEnabled())) return 0;
    let purged = 0;
    for (const id of await this.dueClinics(today)) {
      try {
        await this.purge(id, null);
        purged += 1;
      } catch (err) {
        this.logger.error(`Gagal menghapus data klinik ${id}: ${String(err)}`);
      }
    }
    return purged;
  }

  async statusFor(clinicId: number, today = isoDate()) {
    const [row] = (await this.dataSource.query(
      `SELECT DATE_FORMAT(data_delete_after, '%Y-%m-%d') AS deleteAfter, data_purged_at AS purgedAt
         FROM clinics WHERE id = ?`,
      [clinicId],
    )) as { deleteAfter: string | null; purgedAt: Date | null }[];
    if (!row) throw new NotFoundException('Klinik tidak ditemukan');
    return {
      retentionDays: this.retentionDays,
      deleteAfter: row.deleteAfter,
      daysLeft: row.deleteAfter ? daysUntil(row.deleteAfter, today) : null,
      purgedAt: row.purgedAt,
    };
  }

  /** Untuk Super Admin: klinik yang dijadwalkan dihapus dan yang sudah dihapus. */
  async list(today = isoDate()): Promise<RetentionRow[]> {
    const rows = (await this.dataSource.query(
      `SELECT c.id AS clinicId, c.name AS clinicName,
              DATE_FORMAT(c.data_delete_after, '%Y-%m-%d') AS deleteAfter,
              c.data_purged_at AS purgedAt,
              (SELECT DATE_FORMAT(MAX(end_date), '%Y-%m-%d') FROM clinic_subscriptions WHERE clinic_id = c.id) AS lastEndDate
         FROM clinics c
        WHERE c.data_delete_after IS NOT NULL OR c.data_purged_at IS NOT NULL
        ORDER BY c.data_purged_at IS NOT NULL, c.data_delete_after ASC, c.data_purged_at DESC`,
    )) as Omit<RetentionRow, 'daysLeft'>[];
    return rows.map((r) => ({
      ...r,
      clinicId: Number(r.clinicId),
      daysLeft:
        r.deleteAfter && !r.purgedAt ? daysUntil(r.deleteAfter, today) : null,
    }));
  }

  async postpone(clinicId: number, days: number, by: number) {
    const status = await this.statusFor(clinicId);
    if (status.purgedAt) {
      throw new BadRequestException('Data klinik ini sudah dihapus');
    }
    if (!status.deleteAfter) {
      throw new BadRequestException('Klinik ini tidak dijadwalkan dihapus');
    }
    const from =
      status.deleteAfter > isoDate() ? status.deleteAfter : isoDate();
    const deleteAfter = addDays(from, days);
    await this.dataSource.query(
      'UPDATE clinics SET data_delete_after = ?, data_delete_h7_at = NULL, data_delete_h1_at = NULL WHERE id = ?',
      [deleteAfter, clinicId],
    );
    void this.auditLog.record({
      clinicId,
      actorId: by,
      actorName: 'Super Admin',
      actorRole: 'super_admin',
      actionType: AuditActionType.UPDATE,
      entityType: 'DataRetention',
      entityId: clinicId,
      entityLabel: `Penghapusan data ditunda ${days} hari (s.d. ${deleteAfter})`,
      status: AuditStatus.SUCCESS,
    });
    return this.statusFor(clinicId);
  }

  /**
   * Hapus data satu klinik. Hanya untuk klinik tanpa langganan aktif yang
   * masa unduhnya sudah lewat — kecuali `force` (Super Admin menekan "Hapus
   * sekarang" setelah mengetik nama klinik).
   */
  async purge(
    clinicId: number,
    by: number | null,
    opts: { force?: boolean } = {},
  ) {
    const [clinic] = (await this.dataSource.query(
      `SELECT id, name, logo_url AS logoUrl, data_purged_at AS purgedAt,
              DATE_FORMAT(data_delete_after, '%Y-%m-%d') AS deleteAfter
         FROM clinics WHERE id = ?`,
      [clinicId],
    )) as {
      id: number;
      name: string;
      logoUrl: string | null;
      purgedAt: Date | null;
      deleteAfter: string | null;
    }[];
    if (!clinic) throw new NotFoundException('Klinik tidak ditemukan');
    if (clinic.purgedAt) {
      throw new BadRequestException('Data klinik ini sudah dihapus');
    }
    const lapsed = (await this.lapsedClinics()).some((l) => l.id === clinicId);
    if (!lapsed) {
      throw new BadRequestException(
        'Klinik ini masih punya langganan aktif. Data hanya dihapus setelah langganan berakhir.',
      );
    }
    if (
      !opts.force &&
      (!clinic.deleteAfter || clinic.deleteAfter >= isoDate())
    ) {
      throw new BadRequestException(
        'Masa unduh data klinik ini belum berakhir',
      );
    }

    const files = await this.collectFiles(clinicId, clinic.logoUrl);
    const existing = new Set(
      (
        (await this.dataSource.query(
          `SELECT TABLE_NAME AS t FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'clinic_id'`,
        )) as { t: string }[]
      ).map((r) => r.t),
    );
    const allTables = new Set(
      (
        (await this.dataSource.query(
          'SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()',
        )) as { t: string }[]
      ).map((r) => r.t),
    );

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query('SET FOREIGN_KEY_CHECKS = 0');
      for (const sql of CHILD_DELETES) {
        const table = /^DELETE FROM (\w+)/.exec(sql)![1];
        if (!allTables.has(table)) continue;
        await runner.query(sql, [clinicId]);
      }
      for (const table of existing) {
        if (KEEP_TABLES.has(table)) continue;
        await runner.query(`DELETE FROM \`${table}\` WHERE clinic_id = ?`, [
          clinicId,
        ]);
      }
      // Akun klinik: dinonaktifkan dan dianonimkan (baris tetap ada karena
      // dirujuk riwayat pembayaran langganan).
      const users = (await runner.query(
        "SELECT id FROM users WHERE clinic_id = ? AND role NOT IN ('super_admin', 'multi_clinic_owner')",
        [clinicId],
      )) as { id: number }[];
      for (const { id } of users) {
        await runner.query(
          `UPDATE users
              SET email = ?, name = 'Pengguna dihapus', password_hash = ?,
                  is_active = 0, practitioner_id = NULL, mfa_enabled = 0,
                  mfa_secret = NULL, mfa_backup_codes = NULL,
                  verification_token = NULL, reset_password_token = NULL,
                  reset_password_expires_at = NULL, token_version = token_version + 1
            WHERE id = ?`,
          [
            `dihapus-${id}@apexrecord.invalid`,
            `!purged-${randomBytes(16).toString('hex')}`,
            id,
          ],
        );
      }
      await runner.query(
        `UPDATE clinics
            SET address = '', phone = '', email = NULL, website = NULL,
                sip_number = NULL, logo_url = NULL, operational_hours = NULL,
                satusehat_org_id = NULL, satusehat_client_id = NULL,
                satusehat_client_secret = NULL, satusehat_token = NULL,
                satusehat_token_expires_at = NULL, satusehat_profile = NULL,
                data_purged_at = NOW()
          WHERE id = ?`,
        [clinicId],
      );
      await runner.query('SET FOREIGN_KEY_CHECKS = 1');
      await runner.commitTransaction();
    } catch (err) {
      await runner.rollbackTransaction();
      await runner.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => undefined);
      throw err;
    } finally {
      await runner.release();
    }

    let removed = 0;
    for (const url of files) {
      if (await this.deleteFile(url)) removed += 1;
    }
    this.logger.warn(
      `Data klinik ${clinicId} (${clinic.name}) dihapus${by ? ` oleh user ${by}` : ' otomatis'}; ${removed} berkas dihapus`,
    );
    void this.auditLog.record({
      clinicId: null,
      actorId: by,
      actorName: by ? 'Super Admin' : 'Sistem',
      actorRole: by ? 'super_admin' : 'system',
      actionType: AuditActionType.DELETE,
      entityType: 'DataRetention',
      entityId: clinicId,
      entityLabel: `Data klinik ${clinic.name} dihapus (${removed} berkas)`,
      status: AuditStatus.SUCCESS,
    });
    return { clinicId, filesRemoved: removed };
  }

  private async collectFiles(clinicId: number, logoUrl: string | null) {
    const q = async (sql: string) =>
      (
        (await this.dataSource.query(sql, [clinicId]).catch(() => [])) as {
          u: string | null;
        }[]
      )
        .map((r) => r.u)
        .filter((u): u is string => !!u);
    return [
      ...(logoUrl ? [logoUrl] : []),
      ...(await q(
        'SELECT file_url AS u FROM supporting_exam_images WHERE encounter_id IN (SELECT id FROM encounters WHERE clinic_id = ?)',
      )),
      ...(await q(
        'SELECT photo_url AS u FROM practitioners WHERE clinic_id = ?',
      )),
      ...(await q(
        'SELECT before_image_url AS u FROM clinic_contents WHERE clinic_id = ?',
      )),
      ...(await q(
        'SELECT after_image_url AS u FROM clinic_contents WHERE clinic_id = ?',
      )),
      ...(await q(
        'SELECT image_url AS u FROM clinic_contents WHERE clinic_id = ?',
      )),
    ];
  }

  private async deleteFile(url: string): Promise<boolean> {
    if (url.startsWith('/uploads/')) {
      const path = normalize(join(process.cwd(), url.replace(/^\//, '')));
      if (!path.startsWith(UPLOADS_DIR + sep) || !existsSync(path))
        return false;
      try {
        unlinkSync(path);
        return true;
      } catch {
        return false;
      }
    }
    return this.storage.deleteUploaded(url);
  }

  private async notify(
    clinicId: number,
    deleteAfter: string,
    stage: 'scheduled' | 'h7' | 'h1',
  ) {
    try {
      const recipients = (await this.dataSource.query(
        `SELECT DISTINCT u.email AS email FROM users u
          WHERE u.is_active = 1 AND (
            (u.clinic_id = ? AND u.role IN ('owner', 'manajer_cabang'))
            OR u.id IN (SELECT owner_id FROM owner_clinic_links
                         WHERE clinic_id = ? AND status = 'approved')
          )`,
        [clinicId, clinicId],
      )) as { email: string }[];
      const to = recipients.map((r) => r.email).filter(Boolean);
      if (!to.length) return;
      const [clinic] = (await this.dataSource.query(
        'SELECT name FROM clinics WHERE id = ?',
        [clinicId],
      )) as { name: string }[];
      const name = (clinic?.name ?? 'Klinik Anda').replace(/</g, '&lt;');
      const appUrl = this.configService.get<string>(
        'APP_URL',
        'http://localhost:3000',
      );
      const date = formatDateId(deleteAfter);
      const subject =
        stage === 'scheduled'
          ? `Langganan ${name} berakhir — unduh data Anda sebelum ${date}`
          : stage === 'h7'
            ? `7 hari lagi data ${name} dihapus — unduh sekarang`
            : `Besok data ${name} dihapus — unduh sekarang`;
      await this.resend.emails.send({
        from: 'noreply@send.finarch.my.id',
        to,
        subject,
        html: `
          <h2>Unduh data klinik Anda</h2>
          <p>Langganan ApexRecord untuk <strong>${name}</strong> sudah berakhir.</p>
          <p>Semua data klinik (pasien, rekam medis, tagihan, foto, dan lainnya) masih bisa diunduh
          sampai <strong>${date}</strong>. Setelah tanggal itu data dihapus permanen dan tidak bisa dikembalikan.</p>
          <p>Unduh lewat menu <em>Pengaturan › Data &amp; Privasi › Unduh semua data</em>, atau perpanjang langganan agar data tetap tersimpan.</p>
          <p>
            <a href="${appUrl}/data-privasi" style="display:inline-block;padding:10px 20px;background:#367D2F;color:#fff;text-decoration:none;border-radius:6px;">Unduh data</a>
            &nbsp;
            <a href="${appUrl}/langganan">Perpanjang langganan</a>
          </p>
          <p>Rekam medis wajib disimpan klinik sesuai Permenkes No. 24 Tahun 2022.</p>
          <p>Salam,<br>Tim ApexRecord</p>
        `,
      });
    } catch (err) {
      this.logger.warn(
        `Gagal mengirim email penghapusan data klinik ${clinicId}: ${String(err)}`,
      );
    }
  }
}
