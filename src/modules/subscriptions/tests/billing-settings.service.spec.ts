import { BadRequestException } from '@nestjs/common';
import {
  BillingSettingsService,
  DURATION_DISCOUNTS_KEY,
} from '../billing-settings.service';

describe('BillingSettingsService', () => {
  let rows: Record<string, any>;
  let service: BillingSettingsService;

  beforeEach(() => {
    rows = {};
    const repo = {
      findOne: jest.fn(({ where }) =>
        Promise.resolve(rows[where.settingKey] ?? null),
      ),
      create: jest.fn((data) => data),
      save: jest.fn((row) => {
        rows[row.settingKey] = row;
        return Promise.resolve(row);
      }),
    };
    service = new BillingSettingsService(repo as any);
  });

  it('returns the default 5/10/17% when nothing is stored (positive)', async () => {
    await expect(service.getDurationDiscounts()).resolves.toEqual({
      1: 0,
      3: 5,
      6: 10,
      12: 17,
    });
  });

  it('stores and reads back new discounts (positive)', async () => {
    await expect(
      service.setDurationDiscounts({ 3: 7, 6: 12.5, 12: 20 }, 1),
    ).resolves.toEqual({
      1: 0,
      3: 7,
      6: 12.5,
      12: 20,
    });
    expect(JSON.parse(rows[DURATION_DISCOUNTS_KEY].value)).toEqual({
      3: 7,
      6: 12.5,
      12: 20,
    });
  });

  it('rejects a discount above 50% or missing (negative)', async () => {
    await expect(
      service.setDurationDiscounts({ 3: 5, 6: 10, 12: 60 }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.setDurationDiscounts({ 3: 5 }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('falls back to defaults on a corrupt stored value (edge)', async () => {
    rows[DURATION_DISCOUNTS_KEY] = {
      settingKey: DURATION_DISCOUNTS_KEY,
      value: '{oops',
    };
    await expect(service.getDurationDiscounts()).resolves.toEqual({
      1: 0,
      3: 5,
      6: 10,
      12: 17,
    });
  });
});
