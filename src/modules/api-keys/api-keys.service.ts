import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { In, IsNull, MoreThanOrEqual, Repository } from 'typeorm';
import { ApiKey, ApiKeyType } from './entities/api-key.entity';
import { ApiUsageDaily } from './entities/api-usage-daily.entity';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto/api-key.dto';
import { ApiPlanLimit, limitsForTier, MAX_ACTIVE_KEYS_PER_CLINIC } from './api-plan-limits';
import { ClinicSubscriptionsService } from '../subscriptions/clinic-subscriptions.service';

const CACHE_TTL_MS = 60_000;
const FLUSH_INTERVAL_MS = 5_000;
const DEFAULT_GRACE_PERIOD_DAYS = 3;

export interface AuthenticatedApiKey {
  apiKey: ApiKey;
  limits: ApiPlanLimit;
}

export interface ApiUsageSnapshot {
  limitPerMinute: number;
  remainingThisMinute: number;
  limitPerDay: number;
  remainingToday: number;
}

function apiError(status: number, code: string, message: string) {
  return new HttpException({ success: false, error: { code, message } }, status);
}

/** Today's date in the clinics' timezone — quotas reset at 00:00 WIB. */
export function jakartaDate(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d);
}

export function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '').toLowerCase();
}

/**
 * API keys for the public API: issuing/revoking them for Pengaturan → API,
 * and authenticating + metering every /v1 request.
 *
 * Counters live in memory and are flushed to api_usage_daily every few
 * seconds, so a busy key costs one DB write per flush rather than per
 * request. This assumes a single API process (PM2 fork mode, as deployed);
 * with several processes each would enforce limits on its own share.
 */
@Injectable()
export class ApiKeysService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ApiKeysService.name);

  private readonly keyCache = new Map<string, { apiKey: ApiKey | null; at: number }>();
  private readonly planCache = new Map<number, { limits: ApiPlanLimit; active: boolean; at: number }>();
  private readonly minuteWindows = new Map<number, { minute: number; count: number }>();
  /** clinicId → requests already stored for `date` (loaded once per day). */
  private readonly dailyBase = new Map<number, { date: string; count: number }>();
  /** apiKeyId → requests not yet flushed. */
  private readonly pending = new Map<number, { clinicId: number; date: string; count: number }>();
  private flushTimer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(ApiUsageDaily)
    private readonly usageRepository: Repository<ApiUsageDaily>,
    private readonly clinicSubscriptionsService: ClinicSubscriptionsService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.flushTimer = setInterval(() => void this.flushUsage(), FLUSH_INTERVAL_MS);
    this.flushTimer.unref?.();
  }

  async onModuleDestroy() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flushUsage();
  }

  // ---------------------------------------------------------------- management

  list(clinicId: number) {
    return this.apiKeyRepository.find({
      where: { clinicId },
      order: { revokedAt: 'ASC', createdAt: 'DESC' },
    });
  }

  async create(clinicId: number, dto: CreateApiKeyDto, actorId: number | null) {
    const active = await this.apiKeyRepository.count({ where: { clinicId, revokedAt: IsNull() } });
    if (active >= MAX_ACTIVE_KEYS_PER_CLINIC) {
      throw apiError(400, 'API_KEY_LIMIT', `Maksimal ${MAX_ACTIVE_KEYS_PER_CLINIC} API key aktif per klinik. Cabut key yang tidak dipakai dulu.`);
    }
    const origins = this.cleanOrigins(dto.allowedOrigins);
    if (dto.type === ApiKeyType.PUBLISHABLE && origins.length === 0) {
      throw apiError(400, 'ORIGIN_REQUIRED', 'Publishable key wajib punya minimal satu domain website yang diizinkan.');
    }
    const { rawKey, keyHash, keyPrefix } = this.generateKey(dto.type);
    const apiKey = await this.apiKeyRepository.save(
      this.apiKeyRepository.create({
        clinicId,
        name: dto.name.trim(),
        type: dto.type,
        keyPrefix,
        keyHash,
        allowedOrigins: dto.type === ApiKeyType.PUBLISHABLE ? origins : null,
        createdBy: actorId,
      }),
    );
    return { apiKey, rawKey };
  }

  async update(id: number, clinicId: number, dto: UpdateApiKeyDto) {
    const apiKey = await this.findOwned(id, clinicId);
    if (dto.name !== undefined) apiKey.name = dto.name.trim();
    if (dto.allowedOrigins !== undefined) {
      if (apiKey.type !== ApiKeyType.PUBLISHABLE) {
        throw apiError(400, 'ORIGINS_NOT_APPLICABLE', 'Domain hanya berlaku untuk publishable key.');
      }
      const origins = this.cleanOrigins(dto.allowedOrigins);
      if (origins.length === 0) {
        throw apiError(400, 'ORIGIN_REQUIRED', 'Publishable key wajib punya minimal satu domain website yang diizinkan.');
      }
      apiKey.allowedOrigins = origins;
    }
    const saved = await this.apiKeyRepository.save(apiKey);
    this.forgetKey(saved.keyHash);
    return saved;
  }

  async revoke(id: number, clinicId: number) {
    const apiKey = await this.findOwned(id, clinicId);
    if (!apiKey.revokedAt) {
      apiKey.revokedAt = new Date();
      await this.apiKeyRepository.save(apiKey);
    }
    this.forgetKey(apiKey.keyHash);
    return apiKey;
  }

  /** Issues a new secret for the key (same name, type and domains) and revokes the old one. */
  async rotate(id: number, clinicId: number, actorId: number | null) {
    const old = await this.findOwned(id, clinicId);
    if (old.revokedAt) throw apiError(400, 'API_KEY_REVOKED', 'Key ini sudah dicabut.');
    const { rawKey, keyHash, keyPrefix } = this.generateKey(old.type);
    const apiKey = await this.apiKeyRepository.save(
      this.apiKeyRepository.create({
        clinicId,
        name: old.name,
        type: old.type,
        keyPrefix,
        keyHash,
        allowedOrigins: old.allowedOrigins,
        createdBy: actorId,
      }),
    );
    await this.revoke(old.id, clinicId);
    return { apiKey, rawKey, replaced: old };
  }

  async usage(clinicId: number, days = 30) {
    await this.flushUsage();
    const since = new Date(Date.now() - (days - 1) * 86_400_000);
    const rows = await this.usageRepository.find({
      where: { clinicId, date: MoreThanOrEqual(jakartaDate(since)) },
    });
    const byDate = new Map<string, number>();
    const byKey = new Map<number, number>();
    for (const r of rows) {
      byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.count);
      byKey.set(r.apiKeyId, (byKey.get(r.apiKeyId) ?? 0) + r.count);
    }
    const daily = Array.from({ length: days }, (_, i) => {
      const date = jakartaDate(new Date(since.getTime() + i * 86_400_000));
      return { date, count: byDate.get(date) ?? 0 };
    });
    const { limits, active } = await this.planFor(clinicId, true);
    const today = byDate.get(jakartaDate()) ?? 0;
    return {
      plan: limits.label,
      subscriptionActive: active,
      limitPerDay: limits.perDay,
      limitPerMinute: limits.perMinute,
      usedToday: today,
      remainingToday: Math.max(0, limits.perDay - today),
      daily,
      byKey: [...byKey].map(([apiKeyId, count]) => ({ apiKeyId, count })),
    };
  }

  // ------------------------------------------------------- request-time checks

  /**
   * Validates the key and where it is used from, then counts the request
   * against the per-minute and per-day limits. Throws 401/403/429 errors
   * with a machine-readable code.
   */
  async authenticate(rawKey: string | undefined, origin: string | undefined): Promise<AuthenticatedApiKey & { usage: ApiUsageSnapshot }> {
    if (!rawKey) {
      throw apiError(401, 'API_KEY_MISSING', 'Sertakan API key di header X-Api-Key.');
    }
    const apiKey = await this.lookupKey(rawKey.trim());
    if (!apiKey || apiKey.revokedAt) {
      throw apiError(401, 'API_KEY_INVALID', 'API key tidak valid atau sudah dicabut.');
    }

    if (apiKey.type === ApiKeyType.PUBLISHABLE) {
      const allowed = (apiKey.allowedOrigins ?? []).map(normalizeOrigin);
      if (!origin || !allowed.includes(normalizeOrigin(origin))) {
        throw apiError(403, 'ORIGIN_NOT_ALLOWED', 'Domain ini tidak terdaftar untuk API key tersebut. Tambahkan di Pengaturan → API.');
      }
    } else if (origin) {
      // A browser sends Origin on cross-site requests: a secret key there
      // means it has been embedded in a web page, where anyone can copy it.
      throw apiError(403, 'SECRET_KEY_IN_BROWSER', 'Secret key tidak boleh dipakai dari browser. Gunakan publishable key untuk website.');
    }

    const { limits, active } = await this.planFor(apiKey.clinicId);
    if (!active) {
      throw apiError(403, 'SUBSCRIPTION_INACTIVE', 'Langganan klinik tidak aktif, API dinonaktifkan sementara.');
    }

    const usage = await this.meter(apiKey, limits);
    return { apiKey, limits, usage };
  }

  private async meter(apiKey: ApiKey, limits: ApiPlanLimit): Promise<ApiUsageSnapshot> {
    const minute = Math.floor(Date.now() / 60_000);
    const window = this.minuteWindows.get(apiKey.id);
    const usedThisMinute = window && window.minute === minute ? window.count : 0;
    if (usedThisMinute >= limits.perMinute) {
      throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', `Batas ${limits.perMinute} request per menit terlampaui. Coba lagi sebentar.`);
    }

    const date = jakartaDate();
    const usedToday = (await this.baseCount(apiKey.clinicId, date)) + this.pendingFor(apiKey.clinicId, date);
    if (usedToday >= limits.perDay) {
      throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'QUOTA_EXCEEDED', `Kuota ${limits.perDay.toLocaleString('id-ID')} request per hari (paket ${limits.label}) sudah habis. Kuota direset pukul 00:00 WIB.`);
    }

    this.minuteWindows.set(apiKey.id, { minute, count: usedThisMinute + 1 });
    const p = this.pending.get(apiKey.id);
    if (p && p.date === date) p.count++;
    else {
      if (p) void this.flushUsage();
      this.pending.set(apiKey.id, { clinicId: apiKey.clinicId, date, count: 1 });
    }
    return {
      limitPerMinute: limits.perMinute,
      remainingThisMinute: limits.perMinute - usedThisMinute - 1,
      limitPerDay: limits.perDay,
      remainingToday: limits.perDay - usedToday - 1,
    };
  }

  /** Writes buffered counts to api_usage_daily and stamps last_used_at. */
  async flushUsage(): Promise<void> {
    if (this.pending.size === 0) return;
    const batch = [...this.pending];
    this.pending.clear();
    try {
      for (const [apiKeyId, { clinicId, date, count }] of batch) {
        await this.usageRepository.query(
          `INSERT INTO api_usage_daily (clinic_id, api_key_id, date, count) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE count = count + VALUES(count)`,
          [clinicId, apiKeyId, date, count],
        );
        const base = this.dailyBase.get(clinicId);
        if (base && base.date === date) base.count += count;
      }
      await this.apiKeyRepository.update({ id: In(batch.map(([id]) => id)) }, { lastUsedAt: new Date() });
    } catch (err) {
      // Put the counts back so they are retried on the next flush.
      for (const [apiKeyId, entry] of batch) {
        const cur = this.pending.get(apiKeyId);
        if (cur && cur.date === entry.date) cur.count += entry.count;
        else this.pending.set(apiKeyId, entry);
      }
      this.logger.error(`Gagal menyimpan pemakaian API: ${(err as Error).message}`);
    }
  }

  // ------------------------------------------------------------------ helpers

  private async baseCount(clinicId: number, date: string): Promise<number> {
    const cached = this.dailyBase.get(clinicId);
    if (cached && cached.date === date) return cached.count;
    const row = await this.usageRepository
      .createQueryBuilder('u')
      .select('COALESCE(SUM(u.count), 0)', 'total')
      .where('u.clinic_id = :clinicId AND u.date = :date', { clinicId, date })
      .getRawOne<{ total: string }>();
    const count = Number(row?.total ?? 0);
    this.dailyBase.set(clinicId, { date, count });
    return count;
  }

  private pendingFor(clinicId: number, date: string): number {
    let n = 0;
    for (const p of this.pending.values()) if (p.clinicId === clinicId && p.date === date) n += p.count;
    return n;
  }

  private async lookupKey(rawKey: string): Promise<ApiKey | null> {
    const keyHash = hashKey(rawKey);
    const cached = this.keyCache.get(keyHash);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.apiKey;
    const apiKey = await this.apiKeyRepository.findOne({ where: { keyHash } });
    this.keyCache.set(keyHash, { apiKey, at: Date.now() });
    return apiKey;
  }

  private forgetKey(keyHash: string) {
    this.keyCache.delete(keyHash);
  }

  private async planFor(clinicId: number, fresh = false) {
    const cached = this.planCache.get(clinicId);
    if (!fresh && cached && Date.now() - cached.at < CACHE_TTL_MS) return cached;
    const sub = await this.clinicSubscriptionsService.getCurrentForClinic(clinicId);
    const graceDays = parseInt(
      this.configService.get<string>('SUBSCRIPTION_GRACE_PERIOD_DAYS', String(DEFAULT_GRACE_PERIOD_DAYS)),
      10,
    );
    let active = false;
    if (sub?.endDate) {
      const deadline = new Date(`${sub.endDate}T00:00:00`);
      deadline.setDate(deadline.getDate() + graceDays);
      active = deadline >= new Date(new Date().toDateString());
    }
    const entry = { limits: limitsForTier(sub?.plan?.tier), active, at: Date.now() };
    this.planCache.set(clinicId, entry);
    return entry;
  }

  private async findOwned(id: number, clinicId: number) {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id, clinicId } });
    if (!apiKey) throw new NotFoundException({ success: false, error: { code: 'API_KEY_NOT_FOUND', message: 'API key tidak ditemukan' } });
    return apiKey;
  }

  private cleanOrigins(origins?: string[]): string[] {
    return [...new Set((origins ?? []).map(normalizeOrigin).filter(Boolean))];
  }

  private generateKey(type: ApiKeyType) {
    const body = randomBytes(24).toString('base64url');
    const rawKey = `apx_${type === ApiKeyType.PUBLISHABLE ? 'pk' : 'sk'}_${body}`;
    return { rawKey, keyHash: hashKey(rawKey), keyPrefix: rawKey.slice(0, 12) };
  }
}
