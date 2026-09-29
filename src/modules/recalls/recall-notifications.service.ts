import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { In, Repository } from 'typeorm';
import { Resend } from 'resend';
import {
  PatientRecall,
  PatientRecallStatus,
} from './entities/patient-recall.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../enums';

function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  return Math.round((a.getTime() - b.getTime()) / MS_PER_DAY);
}

/**
 * H-1 "pasien perlu dihubungi besok" email ke Admin & Owner klinik (PRD
 * 5.10). Notifikasi in-app disengaja belum ada — bergantung pada
 * Notification Center yang belum dibangun (lihat PRD 5.17).
 */
@Injectable()
export class RecallNotificationsService {
  private readonly logger = new Logger(RecallNotificationsService.name);
  private readonly resend: Resend;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(PatientRecall)
    private readonly patientRecallRepository: Repository<PatientRecall>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async sendH1Reminders(): Promise<number> {
    const today = new Date(new Date().toDateString());
    const due = await this.patientRecallRepository.find({
      where: { status: PatientRecallStatus.BELUM_DIHUBUNGI },
      relations: { patient: true, tarif: true },
    });

    const byClinic = new Map<number, PatientRecall[]>();
    for (const r of due) {
      if (r.notifiedH1At) continue;
      const daysLeft = daysBetween(new Date(`${r.dueDate}T00:00:00`), today);
      if (daysLeft !== 1) continue;
      const list = byClinic.get(r.clinicId) ?? [];
      list.push(r);
      byClinic.set(r.clinicId, list);
    }

    let sent = 0;
    for (const [clinicId, recalls] of byClinic.entries()) {
      const ok = await this.notifyClinic(clinicId, recalls);
      if (ok) {
        const now = new Date();
        for (const r of recalls) r.notifiedH1At = now;
        await this.patientRecallRepository.save(recalls);
        sent += recalls.length;
      }
    }
    return sent;
  }

  private async notifyClinic(
    clinicId: number,
    recalls: PatientRecall[],
  ): Promise<boolean> {
    const [clinic, staff] = await Promise.all([
      this.clinicRepository.findOne({ where: { id: clinicId } }),
      this.userRepository.find({
        where: {
          clinicId,
          role: In([UserRole.OWNER, UserRole.ADMIN]),
          isActive: true,
        },
      }),
    ]);

    const recipients = staff.map((s) => s.email).filter(Boolean);
    if (recipients.length === 0) {
      this.logger.warn(
        `No active admin/owner email found for clinic ${clinicId} — skipping recall H-1 reminder`,
      );
      return false;
    }

    const appUrl = this.configService.get<string>(
      'APP_URL',
      'http://localhost:3000',
    );
    const rows = recalls
      .map(
        (r) =>
          `<li>${r.patient?.name ?? `Pasien #${r.patientId}`} — ${r.tarif?.name ?? 'kontrol'}</li>`,
      )
      .join('');

    try {
      await this.resend.emails.send({
        from: 'noreply@send.finarch.my.id',
        to: recipients,
        subject: `${recalls.length} pasien perlu dihubungi besok — ${clinic?.name ?? 'Klinik Anda'}`,
        html: `
          <h2>Recall Pasien Besok</h2>
          <p>Halo,</p>
          <p>${recalls.length} pasien di klinik <strong>${clinic?.name ?? ''}</strong> sudah waktunya dihubungi untuk kontrol besok:</p>
          <ul>${rows}</ul>
          <a href="${appUrl}/recall-reminder" style="display: inline-block; padding: 10px 20px; background-color: #4F7EF8; color: white; text-decoration: none; border-radius: 5px;">
            Buka Daftar Recall
          </a>
          <p>Salam,<br>Tim ApexRecord</p>
        `,
      });
      this.logger.log(
        `Sent recall H-1 reminder to clinic ${clinicId} (${recipients.join(', ')}) for ${recalls.length} patient(s)`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send recall H-1 reminder for clinic ${clinicId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
