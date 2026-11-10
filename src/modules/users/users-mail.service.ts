import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  multi_clinic_owner: 'Multi-Klinik Owner',
  owner: 'Owner',
  manajer_cabang: 'Manajer Cabang',
  admin: 'Admin',
  dokter: 'Dokter',
  perawat: 'Perawat',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Email akun baru berisi password sementara (PRD Multi-Klinik alur A). The
 * password only gets the user in once: they must change it on first login.
 * Never throws — the account exists either way, and the inviter also sees
 * the temporary password to hand over manually.
 */
@Injectable()
export class UsersMailService {
  private readonly logger = new Logger(UsersMailService.name);
  private readonly resend: Resend;

  constructor(private readonly configService: ConfigService) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async sendWelcome(input: {
    email: string;
    name: string;
    role: string;
    temporaryPassword: string;
  }): Promise<boolean> {
    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    try {
      await this.resend.emails.send({
        from: 'noreply@send.finarch.my.id',
        to: [input.email],
        subject: 'Akun ApexRecord Anda sudah dibuat',
        html: `
          <h2>Selamat datang di ApexRecord</h2>
          <p>Halo ${escapeHtml(input.name)},</p>
          <p>Akun Anda sebagai <strong>${ROLE_LABEL[input.role] ?? input.role}</strong> sudah dibuat.</p>
          <table cellpadding="6" style="border-collapse: collapse;">
            <tr><td>Email</td><td><strong>${escapeHtml(input.email)}</strong></td></tr>
            <tr><td>Password sementara</td><td><strong style="font-family: monospace; font-size: 15px;">${escapeHtml(input.temporaryPassword)}</strong></td></tr>
          </table>
          <p>Saat login pertama Anda akan diminta mengganti password ini dengan password Anda sendiri.</p>
          <a href="${appUrl}/" style="display:inline-block;padding:10px 20px;background:#367D2F;color:#fff;text-decoration:none;border-radius:6px;">Masuk ke ApexRecord</a>
          <p>Bila Anda tidak merasa diundang, abaikan email ini.</p>
          <p>Salam,<br>Tim ApexRecord</p>
        `,
      });
      return true;
    } catch (error) {
      this.logger.warn(
        `Gagal mengirim email akun baru ke ${input.email}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
