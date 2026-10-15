import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSetting } from '../features/entities/platform-setting.entity';
import { DEFAULT_DURATION_DISCOUNTS, DURATION_OPTIONS } from './limits/pricing';

export const DURATION_DISCOUNTS_KEY = 'billing.duration_discounts';
const MAX_DISCOUNT_PCT = 50;

/**
 * Diskon lama langganan (3/6/12 bulan) yang diatur Super Admin. Stored as
 * JSON in platform_settings so no deploy is needed to change it.
 */
@Injectable()
export class BillingSettingsService {
  constructor(
    @InjectRepository(PlatformSetting)
    private readonly repo: Repository<PlatformSetting>,
  ) {}

  async getDurationDiscounts(): Promise<Record<number, number>> {
    const row = await this.repo.findOne({
      where: { settingKey: DURATION_DISCOUNTS_KEY },
    });
    if (!row) return { ...DEFAULT_DURATION_DISCOUNTS };
    try {
      const parsed = JSON.parse(row.value) as Record<string, number>;
      const result: Record<number, number> = { 1: 0 };
      for (const m of DURATION_OPTIONS) {
        if (m === 1) continue;
        const v = Number(parsed[m]);
        result[m] = Number.isFinite(v) ? v : DEFAULT_DURATION_DISCOUNTS[m];
      }
      return result;
    } catch {
      return { ...DEFAULT_DURATION_DISCOUNTS };
    }
  }

  async setDurationDiscounts(input: object, by: number) {
    const value: Record<number, number> = {};
    for (const m of DURATION_OPTIONS) {
      if (m === 1) continue;
      const v = Number((input as Record<number, unknown>)[m]);
      if (!Number.isFinite(v) || v < 0 || v > MAX_DISCOUNT_PCT) {
        throw new BadRequestException({
          success: false,
          error: {
            code: 'INVALID_DISCOUNT',
            message: `Diskon ${m} bulan harus 0–${MAX_DISCOUNT_PCT}%`,
          },
        });
      }
      value[m] = Math.round(v * 100) / 100;
    }
    const row =
      (await this.repo.findOne({
        where: { settingKey: DURATION_DISCOUNTS_KEY },
      })) ??
      this.repo.create({ settingKey: DURATION_DISCOUNTS_KEY, createdBy: by });
    Object.assign(row, { value: JSON.stringify(value), updatedBy: by });
    await this.repo.save(row);
    return this.getDurationDiscounts();
  }
}
