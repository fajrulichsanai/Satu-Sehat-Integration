import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ClinicSubscription,
  ClinicSubscriptionStatus,
} from './entities/clinic-subscription.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { SubscriptionPlansService } from './subscription-plans.service';
import { ClinicSubscriptionQueryDto } from './dto/clinic-subscription.dto';
import { PaginatedResult } from '../../common/dto/pagination.dto';

function isoToday(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type SatusehatStatus = 'aktif' | 'dimatikan' | 'belum_siap';

export interface ClinicSubscriptionSummary {
  clinicId: number;
  clinicName: string;
  subscription: ClinicSubscription | null;
  /** Kolom tambahan daftar klinik Super Admin (PRD KL-01, SH-06). */
  createdAt?: Date;
  owner?: { id: number; name: string; email: string } | null;
  activeUsers?: number;
  satusehatStatus?: SatusehatStatus;
  multiClinicOwner?: { id: number; name: string } | null;
  dataDeleteAfter?: string | null;
  dataPurgedAt?: Date | null;
}

@Injectable()
export class ClinicSubscriptionsService {
  private readonly logger = new Logger(ClinicSubscriptionsService.name);

  constructor(
    @InjectRepository(ClinicSubscription)
    private readonly clinicSubscriptionRepository: Repository<ClinicSubscription>,
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  /** Latest row for a clinic represents its current subscription (see entity docblock). */
  getCurrentForClinic(clinicId: number): Promise<ClinicSubscription | null> {
    return this.clinicSubscriptionRepository.findOne({
      where: { clinicId },
      order: { id: 'DESC' },
      relations: { plan: true },
    });
  }

  /**
   * Langganan yang berlaku hari ini: baris aktif yang sudah dimulai. Baris
   * yang dibayar di muka untuk periode berikutnya (mis. turun paket) belum
   * berlaku sampai tanggal mulainya.
   */
  async getInEffectForClinic(
    clinicId: number,
    today: string = isoToday(),
  ): Promise<ClinicSubscription | null> {
    return this.clinicSubscriptionRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.plan', 'plan')
      .where('s.clinicId = :clinicId', { clinicId })
      .andWhere('s.status = :status', {
        status: ClinicSubscriptionStatus.ACTIVE,
      })
      .andWhere('s.startDate <= :today AND s.endDate >= :today', { today })
      .orderBy('s.id', 'DESC')
      .getOne();
  }

  /**
   * Naik paket (PRD keputusan tagihan): paket baru berlaku mulai hari ini
   * untuk sisa masa aktif — baris yang sedang berlaku dipecah (sampai kemarin
   * paket lama, mulai hari ini paket baru) dan baris yang sudah dibayar di
   * muka untuk periode berikutnya ikut naik. Masa aktif tidak bertambah.
   */
  async applyUpgrade(
    clinicId: number,
    planId: number,
    by: number,
    today: string = isoToday(),
  ): Promise<ClinicSubscription | null> {
    const current = await this.getInEffectForClinic(clinicId, today);
    if (!current) return null;
    const note = `Naik paket dari ${current.plan?.name ?? `#${current.planId}`}`;
    let upgraded: ClinicSubscription;
    if (current.startDate < today) {
      const yesterday = new Date(`${today}T00:00:00`);
      yesterday.setDate(yesterday.getDate() - 1);
      const newRow = this.clinicSubscriptionRepository.create({
        clinicId,
        planId,
        startDate: today,
        endDate: current.endDate,
        status: ClinicSubscriptionStatus.ACTIVE,
        extendedBy: by,
        notes: note,
        createdBy: by,
      });
      current.endDate = isoToday(yesterday);
      current.updatedBy = by;
      await this.clinicSubscriptionRepository.save(current);
      upgraded = await this.clinicSubscriptionRepository.save(newRow);
    } else {
      current.planId = planId;
      current.notes = current.notes ? `${current.notes} · ${note}` : note;
      current.updatedBy = by;
      upgraded = await this.clinicSubscriptionRepository.save(current);
    }
    // Periode berikutnya yang sudah dibayar dengan paket lama ikut naik.
    await this.clinicSubscriptionRepository
      .createQueryBuilder()
      .update()
      .set({ planId, updatedBy: by })
      .where(
        'clinicId = :clinicId AND status = :status AND startDate > :today AND planId = :old',
        {
          clinicId,
          status: ClinicSubscriptionStatus.ACTIVE,
          today,
          old: current.planId,
        },
      )
      .execute();
    return upgraded;
  }

  /** Tanggal berakhir terjauh dari langganan aktif (termasuk periode yang sudah dibayar di muka). */
  async paidUntil(clinicId: number): Promise<string | null> {
    const row = await this.clinicSubscriptionRepository
      .createQueryBuilder('s')
      .select('MAX(s.endDate)', 'end')
      .where('s.clinicId = :clinicId AND s.status = :status', {
        clinicId,
        status: ClinicSubscriptionStatus.ACTIVE,
      })
      .getRawOne<{ end: string | Date | null }>();
    if (!row?.end) return null;
    return typeof row.end === 'string'
      ? row.end.slice(0, 10)
      : isoToday(row.end);
  }

  getHistoryForClinic(clinicId: number): Promise<ClinicSubscription[]> {
    return this.clinicSubscriptionRepository.find({
      where: { clinicId },
      order: { id: 'DESC' },
      relations: { plan: true },
    });
  }

  private async latestByClinicIds(
    clinicIds: number[],
  ): Promise<Map<number, ClinicSubscription>> {
    if (clinicIds.length === 0) return new Map();
    const rows = await this.clinicSubscriptionRepository.find({
      where: clinicIds.map((clinicId) => ({ clinicId })),
      order: { id: 'DESC' },
      relations: { plan: true },
    });
    const map = new Map<number, ClinicSubscription>();
    for (const row of rows) {
      if (!map.has(row.clinicId)) map.set(row.clinicId, row);
    }
    return map;
  }

  async listAll(
    query: ClinicSubscriptionQueryDto,
  ): Promise<PaginatedResult<ClinicSubscriptionSummary>> {
    const { page, limit, status, search } = query;

    const clinicsQb = this.clinicRepository
      .createQueryBuilder('c')
      .orderBy('c.name', 'ASC');
    if (search) {
      clinicsQb.andWhere('c.name LIKE :search', { search: `%${search}%` });
    }
    const clinics = await clinicsQb.getMany();
    const latest = await this.latestByClinicIds(clinics.map((c) => c.id));

    const extras = await this.clinicExtras(clinics.map((c) => c.id));
    let rows: ClinicSubscriptionSummary[] = clinics.map((c) => ({
      clinicId: c.id,
      clinicName: c.name,
      subscription: latest.get(c.id) ?? null,
      createdAt: c.createdAt,
      dataDeleteAfter: c.dataDeleteAfter,
      dataPurgedAt: c.dataPurgedAt,
      ...extras(c),
    }));

    if (status) {
      rows = rows.filter((r) => r.subscription?.status === status);
    }

    const total = rows.length;
    const start = (page - 1) * limit;
    const data = rows.slice(start, start + limit);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  /**
   * Owner, jumlah akun aktif, status SATUSEHAT (SH-06: aktif, dimatikan
   * klinik, belum siap) dan owner multiklinik per klinik — beberapa query
   * kumpulan, bukan satu query per klinik.
   */
  private async clinicExtras(clinicIds: number[]) {
    type Owner = { clinicId: number; id: number; name: string; email: string };
    const q = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
      clinicIds.length
        ? this.clinicRepository.manager.query(sql, params)
        : Promise.resolve([]);
    const [owners, counts, features, links, global] = await Promise.all([
      q<Owner>(
        `SELECT clinic_id AS clinicId, id, name, email FROM users
          WHERE clinic_id IN (?) AND role = 'owner' ORDER BY is_active DESC, id ASC`,
        [clinicIds],
      ),
      q<{ clinicId: number; n: number }>(
        `SELECT clinic_id AS clinicId, COUNT(*) AS n FROM users
          WHERE clinic_id IN (?) AND is_active = 1 GROUP BY clinic_id`,
        [clinicIds],
      ),
      q<{ clinicId: number; enabled: number }>(
        `SELECT clinic_id AS clinicId, enabled FROM clinic_features
          WHERE clinic_id IN (?) AND feature_key = 'satusehat'`,
        [clinicIds],
      ),
      q<{ clinicId: number; id: number; name: string }>(
        `SELECT l.clinic_id AS clinicId, u.id, u.name FROM owner_clinic_links l
           JOIN users u ON u.id = l.owner_id
          WHERE l.clinic_id IN (?) AND l.status = 'approved'`,
        [clinicIds],
      ),
      q<{ value: string }>(
        "SELECT value FROM platform_settings WHERE setting_key = 'satusehat.enabled'",
      ),
    ]);
    const ownerBy = new Map<number, Owner>();
    for (const o of owners) {
      if (!ownerBy.has(Number(o.clinicId))) ownerBy.set(Number(o.clinicId), o);
    }
    const countBy = new Map(
      counts.map((c) => [Number(c.clinicId), Number(c.n)]),
    );
    const featureBy = new Map(
      features.map((f) => [Number(f.clinicId), Number(f.enabled) === 1]),
    );
    const linkBy = new Map(
      links.map((l) => [
        Number(l.clinicId),
        { id: Number(l.id), name: l.name },
      ]),
    );
    const globalOn = global[0]?.value === 'true';

    return (clinic: Clinic) => {
      const owner = ownerBy.get(clinic.id);
      const satusehatStatus: SatusehatStatus =
        featureBy.get(clinic.id) === false
          ? 'dimatikan'
          : globalOn && clinic.satusehatClientId && clinic.satusehatOrgId
            ? 'aktif'
            : 'belum_siap';
      return {
        owner: owner
          ? { id: Number(owner.id), name: owner.name, email: owner.email }
          : null,
        activeUsers: countBy.get(clinic.id) ?? 0,
        satusehatStatus,
        multiClinicOwner: linkBy.get(clinic.id) ?? null,
      };
    };
  }

  /**
   * Creates a new active subscription row for the clinic, stacking on top of
   * the current end date if still active (or starting from today otherwise).
   * Shared by the manual super-admin extend flow and payment confirmation.
   */
  async extendSubscription(
    clinicId: number,
    planId: number,
    extendedBy: number,
    notes?: string | null,
    /** Berapa periode paket yang dibayar (lama langganan 3/6/12 bulan). */
    periods = 1,
  ): Promise<ClinicSubscription> {
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });
    if (!clinic) {
      throw new NotFoundException({
        success: false,
        error: { code: 'CLINIC_NOT_FOUND', message: 'Klinik tidak ditemukan' },
      });
    }

    if (clinic.dataPurgedAt) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'CLINIC_DATA_PURGED',
          message:
            'Data klinik ini sudah dihapus setelah berhenti berlangganan. Daftarkan klinik baru.',
        },
      });
    }

    const plan = await this.subscriptionPlansService.findOne(planId);
    const current = await this.getCurrentForClinic(clinicId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentEnd =
      current?.status === ClinicSubscriptionStatus.ACTIVE
        ? new Date(`${current.endDate}T00:00:00`)
        : null;
    const base = currentEnd && currentEnd > today ? currentEnd : today;

    const endDate = new Date(base);
    if (periods > 1 && plan.billingCycle !== 'yearly') {
      // 3/6/12 bulan: calendar months, so 12 months is a full year. Clamp
      // to the month's last day (31 Des + 6 bulan = 30 Jun, not 1 Jul).
      const day = endDate.getDate();
      endDate.setDate(1);
      endDate.setMonth(endDate.getMonth() + periods);
      const lastDay = new Date(
        endDate.getFullYear(),
        endDate.getMonth() + 1,
        0,
      ).getDate();
      endDate.setDate(Math.min(day, lastDay));
    } else {
      endDate.setDate(
        endDate.getDate() + plan.durationDays * Math.max(1, periods),
      );
    }

    const row = this.clinicSubscriptionRepository.create({
      clinicId,
      planId,
      startDate: base.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      status: ClinicSubscriptionStatus.ACTIVE,
      extendedBy,
      notes: notes ?? null,
      createdBy: extendedBy,
    });
    const saved = await this.clinicSubscriptionRepository.save(row);
    // Berlangganan lagi membatalkan jadwal hapus data (DataRetentionService).
    if (clinic.dataDeleteAfter) {
      await this.clinicRepository.update(clinicId, {
        dataDeleteAfter: null,
        dataDeleteH7At: null,
        dataDeleteH1At: null,
      });
    }
    const withPlan = await this.clinicSubscriptionRepository.findOne({
      where: { id: saved.id },
      relations: { plan: true },
    });
    return withPlan!;
  }

  /**
   * Auto-enrolls a freshly registered clinic into the Free Trial plan (14
   * hari, semua fitur sama seperti Starter — lihat PRD bagian 7). Never
   * throws: a clinic that fails to get a trial simply starts with no
   * subscription, same as today's behavior, rather than blocking registration.
   */
  async provisionTrialForNewClinic(
    clinicId: number,
    userId: number,
  ): Promise<ClinicSubscription | null> {
    try {
      const trialPlan =
        await this.subscriptionPlansService.findActiveTrialPlan();
      if (!trialPlan) {
        this.logger.warn(
          `No active trial plan configured — clinic ${clinicId} registered without a trial subscription`,
        );
        return null;
      }
      return await this.extendSubscription(
        clinicId,
        trialPlan.id,
        userId,
        'Free trial otomatis saat registrasi',
      );
    } catch (error) {
      this.logger.error(
        `Failed to provision trial for clinic ${clinicId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /** Flips any active-but-lapsed row to expired. Run daily by the cron job. */
  async expireLapsedSubscriptions(): Promise<number> {
    const today = new Date().toISOString().slice(0, 10);
    const result = await this.clinicSubscriptionRepository
      .createQueryBuilder()
      .update(ClinicSubscription)
      .set({ status: ClinicSubscriptionStatus.EXPIRED })
      .where('status = :active', { active: ClinicSubscriptionStatus.ACTIVE })
      .andWhere('end_date < :today', { today })
      .execute();
    return result.affected ?? 0;
  }
}
