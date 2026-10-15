import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Email untuk alur hubungan multiklinik. Never throws — a failed email must
 * not undo the request/answer it describes (the in-app Persetujuan page is
 * the primary channel; email is the nudge).
 */
@Injectable()
export class MultiClinicMailService {
  private readonly logger = new Logger(MultiClinicMailService.name);
  private readonly resend: Resend;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  private appUrl() {
    return this.configService.get<string>('APP_URL', 'http://localhost:3000');
  }

  private async send(to: string[], subject: string, html: string) {
    if (to.length === 0) return;
    try {
      await this.resend.emails.send({
        from: 'noreply@send.finarch.my.id',
        to,
        subject,
        html,
      });
    } catch (error) {
      this.logger.warn(
        `Gagal mengirim email "${subject}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Ke owner klinik: ada permintaan hubungan multiklinik yang perlu dijawab. */
  linkRequested(
    to: string[],
    clinicName: string,
    ownerName: string,
    expiresAt: Date,
  ) {
    return this.send(
      to,
      `Permintaan hubungan multiklinik untuk ${clinicName}`,
      `
        <h2>Permintaan hubungan multiklinik</h2>
        <p>Halo,</p>
        <p><strong>${escapeHtml(ownerName)}</strong> meminta klinik <strong>${escapeHtml(clinicName)}</strong> dihubungkan ke akun Multi-Klinik miliknya.</p>
        <p>Bila disetujui, ia dapat melihat laporan klinik ini dan masuk ke klinik untuk mengatur pengguna, tarif, Info Klinik, dan SATUSEHAT dengan hak yang sama seperti owner klinik.</p>
        <p>Permintaan ini kedaluwarsa pada ${expiresAt.toLocaleDateString('id-ID', { dateStyle: 'long' })} bila tidak dijawab.</p>
        <a href="${this.appUrl()}/persetujuan" style="display:inline-block;padding:10px 20px;background:#367D2F;color:#fff;text-decoration:none;border-radius:6px;">Buka halaman Persetujuan</a>
        <p>Salam,<br>Tim ApexRecord</p>
      `,
    );
  }

  /** Ke owner multiklinik: owner klinik menjawab permintaan. */
  linkAnswered(to: string[], clinicName: string, approved: boolean) {
    return this.send(
      to,
      approved
        ? `${clinicName} menyetujui hubungan multiklinik`
        : `${clinicName} menolak hubungan multiklinik`,
      `
        <h2>${approved ? 'Permintaan disetujui' : 'Permintaan ditolak'}</h2>
        <p>Owner klinik <strong>${escapeHtml(clinicName)}</strong> ${approved ? 'menyetujui' : 'menolak'} permintaan hubungan ke akun Multi-Klinik Anda.</p>
        ${approved ? `<a href="${this.appUrl()}/multi-klinik/dashboard" style="display:inline-block;padding:10px 20px;background:#367D2F;color:#fff;text-decoration:none;border-radius:6px;">Buka dashboard multiklinik</a>` : '<p>Hubungi tim ApexRecord bila ini tidak sesuai.</p>'}
        <p>Salam,<br>Tim ApexRecord</p>
      `,
    );
  }
}
