import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSetting } from './entities/platform-setting.entity';

/** Saklar global SATUSEHAT — mati sampai integrasi siap dipakai klinik */
export const SATUSEHAT_ENABLED_KEY = 'satusehat.enabled';

/**
 * Penghapusan otomatis data klinik yang berhenti berlangganan setelah masa
 * unduh 15 hari. Bawaan mati: jadwal tetap dibuat dan diberitahukan, tetapi
 * data baru dihapus setelah Super Admin menyalakan saklar ini (atau
 * menghapusnya sendiri per klinik).
 */
export const AUTO_PURGE_KEY = 'retention.auto_purge';

/** Dibaca di setiap pemeriksaan fitur — disimpan sebentar di memori */
const CACHE_MS = 30_000;

@Injectable()
export class PlatformSettingsService {
  private cache: { at: number; value: Map<string, string> } | null = null;

  constructor(
    @InjectRepository(PlatformSetting)
    private readonly repo: Repository<PlatformSetting>,
  ) {}

  async isSatusehatEnabled(): Promise<boolean> {
    return (await this.all()).get(SATUSEHAT_ENABLED_KEY) === 'true';
  }

  async isAutoPurgeEnabled(): Promise<boolean> {
    return (await this.all()).get(AUTO_PURGE_KEY) === 'true';
  }

  async get() {
    return {
      satusehatEnabled: await this.isSatusehatEnabled(),
      autoPurgeEnabled: await this.isAutoPurgeEnabled(),
    };
  }

  setSatusehatEnabled(enabled: boolean, by: number) {
    return this.setFlag(SATUSEHAT_ENABLED_KEY, enabled, by);
  }

  setAutoPurgeEnabled(enabled: boolean, by: number) {
    return this.setFlag(AUTO_PURGE_KEY, enabled, by);
  }

  private async setFlag(key: string, enabled: boolean, by: number) {
    const row =
      (await this.repo.findOne({ where: { settingKey: key } })) ??
      this.repo.create({ settingKey: key, createdBy: by });
    Object.assign(row, { value: String(enabled), updatedBy: by });
    await this.repo.save(row);
    this.cache = null;
    return this.get();
  }

  private async all(): Promise<Map<string, string>> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) {
      return this.cache.value;
    }
    const rows = await this.repo.find();
    const value = new Map(rows.map((r) => [r.settingKey, r.value]));
    this.cache = { at: Date.now(), value };
    return value;
  }
}
