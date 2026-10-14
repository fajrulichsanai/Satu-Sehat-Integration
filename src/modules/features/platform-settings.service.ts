import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSetting } from './entities/platform-setting.entity';

/** Saklar global SATUSEHAT — mati sampai integrasi siap dipakai klinik */
export const SATUSEHAT_ENABLED_KEY = 'satusehat.enabled';

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

  async get() {
    return { satusehatEnabled: await this.isSatusehatEnabled() };
  }

  async setSatusehatEnabled(enabled: boolean, by: number) {
    const row =
      (await this.repo.findOne({
        where: { settingKey: SATUSEHAT_ENABLED_KEY },
      })) ??
      this.repo.create({ settingKey: SATUSEHAT_ENABLED_KEY, createdBy: by });
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
