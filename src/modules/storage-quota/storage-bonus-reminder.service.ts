import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Resend } from 'resend';
import { localDate } from './storage-quota.service';
import { STORAGE_ADDON_PRICE_PER_GB } from '../subscriptions/limits/plan-limits';

/** Hari sebelum masa gratis bonus berakhir untuk mengirim pengingat. */
export const BONUS_REMINDER_DAYS = 7;

interface DueBonus {
  id: number;
  gb: number;
  freeUntil: string;
  clinicId: number | null;
  ownerId: number | null;
}

/**
 * Bonus storage gratis yang segera berakhir: kirim email ke yang membayar
 * (owner klinik, atau owner multiklinik untuk jatah bersama) supaya tagihan
 * berikutnya tidak mengejutkan. Satu kali per bonus (reminded_at).
 */
@Injectable()
export class StorageBonusReminderService {
  private readonly logger = new Logger(StorageBonusReminderService.name);
  private readonly resend: Resend;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async remindEndingBonuses(now: Date = new Date()): Promise<number> {
    const until = new Date(now);
    until.setDate(until.getDate() + BONUS_REMINDER_DAYS);
    let sent = 0;
    try {
      const due: DueBonus[] = await this.dataSource.query(
        `SELECT id, gb, DATE_FORMAT(free_until, '%Y-%m-%d') AS freeUntil,
                clinic_id AS clinicId, owner_id AS ownerId
           FROM storage_addons
          WHERE is_free = 1 AND reminded_at IS NULL
            AND free_until IS NOT NULL AND free_until BETWEEN ? AND ?`,
        [localDate(now), localDate(until)],
      );
      for (const bonus of due) {
        if (await this.notify(bonus)) {
          await this.dataSource.query(
            'UPDATE storage_addons SET reminded_at = NOW() WHERE id = ?',
            [bonus.id],
          );
          sent += 1;
        }
      }
      if (sent) this.logger.log(`${sent} pengingat bonus storage terkirim`);
    } catch (error) {
      this.logger.error(
        `Gagal mengirim pengingat bonus storage: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return sent;
  }

  private async notify(bonus: DueBonus): Promise<boolean> {
    const recipients: { email: string }[] = bonus.ownerId
      ? await this.dataSource.query(
          'SELECT email FROM users WHERE id = ? AND is_active = 1',
          [bonus.ownerId],
        )
      : await this.dataSource.query(
          "SELECT email FROM users WHERE clinic_id = ? AND role IN ('owner','manajer_cabang') AND is_active = 1",
          [bonus.clinicId],
        );
    const to = recipients.map((r) => r.email).filter(Boolean);
    if (to.length === 0) return false;

    const gb = Number(bonus.gb);
    const end = new Date(`${bonus.freeUntil}T00:00:00`).toLocaleDateString(
      'id-ID',
      { dateStyle: 'long' },
    );
    const monthly = (gb * STORAGE_ADDON_PRICE_PER_GB).toLocaleString('id-ID');
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    const page = bonus.ownerId ? '/multi-klinik/langganan' : '/langganan';
    try {
      await this.resend.emails.send({
        from: 'noreply@send.finarch.my.id',
        to,
        subject: `Bonus storage ${gb} GB gratis sampai ${end}`,
        html: `
          <h2>Masa gratis bonus storage segera berakhir</h2>
          <p>Halo,</p>
          <p>Bonus storage <strong>${gb} GB</strong> dari tim ApexRecord gratis sampai <strong>${end}</strong>.</p>
          <p>Setelah itu storage ini tetap tersedia dan ikut tagihan perpanjangan berikutnya sebesar <strong>Rp${monthly} per bulan</strong>.</p>
          <p>Bila tidak ingin melanjutkan, hubungi tim ApexRecord sebelum tanggal tersebut.</p>
          <a href="${appUrl}${page}" style="display:inline-block;padding:10px 20px;background:#367D2F;color:#fff;text-decoration:none;border-radius:6px;">Lihat Langganan</a>
          <p>Salam,<br>Tim ApexRecord</p>
        `,
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `Gagal mengirim pengingat bonus #${bonus.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
