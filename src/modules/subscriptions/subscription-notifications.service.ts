import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Resend } from 'resend';
import {
  ClinicSubscription,
  ClinicSubscriptionStatus,
} from './entities/clinic-subscription.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../enums';

function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);
}

/**
 * Sends the H-7 / H-1 "your subscription is about to expire" email to a
 * clinic's owner(s). In-app warning (the renew popup, H-7 through expiry)
 * is handled entirely on the frontend from the subscription's endDate —
 * this service only covers the out-of-band email channel.
 */
@Injectable()
export class SubscriptionNotificationsService {
  private readonly logger = new Logger(SubscriptionNotificationsService.name);
  private readonly resend: Resend;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(ClinicSubscription)
    private readonly clinicSubscriptionRepository: Repository<ClinicSubscription>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async sendUpcomingExpiryReminders(): Promise<{
    h7Sent: number;
    h1Sent: number;
  }> {
    const today = new Date(new Date().toDateString());
    const active = await this.clinicSubscriptionRepository.find({
      where: { status: ClinicSubscriptionStatus.ACTIVE },
      relations: { plan: true },
      order: { id: 'DESC' },
    });

    // Only the latest row per clinic is the "current" subscription (see
    // ClinicSubscription docblock) — earlier ACTIVE rows are stale history.
    const latestByClinic = new Map<number, ClinicSubscription>();
    for (const row of active) {
      if (!latestByClinic.has(row.clinicId))
        latestByClinic.set(row.clinicId, row);
    }

    let h7Sent = 0;
    let h1Sent = 0;

    for (const sub of latestByClinic.values()) {
      const daysLeft = daysBetween(new Date(`${sub.endDate}T00:00:00`), today);

      if (daysLeft === 7 && !sub.notifiedH7At) {
        if (await this.notifyClinic(sub, 7)) {
          sub.notifiedH7At = new Date();
          await this.clinicSubscriptionRepository.save(sub);
          h7Sent += 1;
        }
      } else if (daysLeft === 1 && !sub.notifiedH1At) {
        if (await this.notifyClinic(sub, 1)) {
          sub.notifiedH1At = new Date();
          await this.clinicSubscriptionRepository.save(sub);
          h1Sent += 1;
        }
      }
    }

    return { h7Sent, h1Sent };
  }

  private async notifyClinic(
    sub: ClinicSubscription,
    daysLeft: number,
  ): Promise<boolean> {
    const [clinic, owners] = await Promise.all([
      this.clinicRepository.findOne({ where: { id: sub.clinicId } }),
      this.userRepository.find({
        where: { clinicId: sub.clinicId, role: UserRole.OWNER, isActive: true },
      }),
    ]);

    const recipients = owners.map((o) => o.email).filter(Boolean);
    if (recipients.length === 0) {
      this.logger.warn(
        `No active owner email found for clinic ${sub.clinicId} — skipping H-${daysLeft} reminder`,
      );
      return false;
    }

    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );

    try {
      await this.resend.emails.send({
        from: 'noreply@send.finarch.my.id',
        to: recipients,
        subject: `Langganan ${clinic?.name ?? 'Klinik Anda'} akan berakhir dalam ${daysLeft} hari`,
        html: `
          <h2>Langganan Akan Berakhir</h2>
          <p>Halo,</p>
          <p>Langganan ApexRecord untuk klinik <strong>${clinic?.name ?? ''}</strong> akan berakhir dalam <strong>${daysLeft} hari</strong> (${sub.endDate}).</p>
          <p>Segera perpanjang agar tidak kehilangan akses untuk menambah, mengubah, atau menghapus data.</p>
          <a href="${appUrl}/langganan" style="display: inline-block; padding: 10px 20px; background-color: #4F7EF8; color: white; text-decoration: none; border-radius: 5px;">
            Perpanjang Sekarang
          </a>
          <p>Salam,<br>Tim ApexRecord</p>
        `,
      });
      this.logger.log(
        `Sent H-${daysLeft} expiry reminder to clinic ${sub.clinicId} (${recipients.join(', ')})`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send H-${daysLeft} reminder for clinic ${sub.clinicId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
