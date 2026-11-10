import { BadRequestException } from '@nestjs/common';
import {
  DataRetentionService,
  addDays,
  daysUntil,
} from '../data-retention.service';

function build(rows: {
  lapsed?: { id: number; lastEnd: string }[];
  scheduled?: { id: number }[];
  autoPurge?: boolean;
}) {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const dataSource = {
    query: jest.fn((sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('HAVING SUM')) return Promise.resolve(rows.lapsed ?? []);
      if (
        sql.startsWith(
          'SELECT id FROM clinics WHERE data_delete_after IS NOT NULL AND data_purged_at',
        )
      )
        return Promise.resolve(rows.scheduled ?? []);
      if (sql.includes('FROM users u')) return Promise.resolve([]);
      return Promise.resolve([]);
    }),
  };
  const config = {
    get: jest.fn((k: string, d?: string) =>
      k === 'RESEND_API_KEY' ? 're_test' : d,
    ),
  };
  const platform = {
    isAutoPurgeEnabled: jest.fn().mockResolvedValue(!!rows.autoPurge),
  };
  const audit = { record: jest.fn() };
  const service = new DataRetentionService(
    dataSource as any,
    config as any,
    {} as any,
    platform as any,
    audit as any,
  );
  return { service, calls, dataSource };
}

describe('DataRetentionService', () => {
  it('date helpers add days and count down (positive)', () => {
    expect(addDays('2026-12-25', 15)).toBe('2027-01-09');
    expect(daysUntil('2026-10-28', '2026-10-15')).toBe(13);
    expect(daysUntil('2026-10-14', '2026-10-15')).toBe(-1);
  });

  it('schedules a fresh lapse 15 days after the end date (positive)', async () => {
    const { service, calls } = build({
      lapsed: [{ id: 6, lastEnd: '2026-10-13' }],
    });
    await expect(service.scheduleLapsed('2026-10-15')).resolves.toEqual({
      scheduled: 1,
      cancelled: 0,
    });
    const update = calls.find((c) =>
      c.sql.startsWith('UPDATE clinics SET data_delete_after = ?'),
    );
    expect(update?.params).toEqual(['2026-10-28', 6]);
  });

  it('gives a long-lapsed clinic the full 15 days from today (edge)', async () => {
    const { service, calls } = build({
      lapsed: [{ id: 4, lastEnd: '2026-09-01' }],
    });
    await service.scheduleLapsed('2026-10-15');
    const update = calls.find((c) =>
      c.sql.startsWith('UPDATE clinics SET data_delete_after = ?'),
    );
    expect(update?.params).toEqual(['2026-10-30', 4]);
  });

  it('cancels the schedule of a clinic that subscribed again (positive)', async () => {
    const { service, calls } = build({ lapsed: [], scheduled: [{ id: 9 }] });
    await expect(service.scheduleLapsed('2026-10-15')).resolves.toEqual({
      scheduled: 0,
      cancelled: 1,
    });
    expect(
      calls.some(
        (c) =>
          c.sql.includes('SET data_delete_after = NULL') && c.params?.[0] === 9,
      ),
    ).toBe(true);
  });

  it('does not purge anything while the auto-purge switch is off (negative)', async () => {
    const { service } = build({
      lapsed: [{ id: 6, lastEnd: '2026-01-01' }],
      autoPurge: false,
    });
    const purge = jest.spyOn(service, 'purge');
    await expect(service.purgeDue('2026-10-15')).resolves.toBe(0);
    expect(purge).not.toHaveBeenCalled();
  });

  it('refuses to purge a clinic that still has an active subscription (negative)', async () => {
    const { service, dataSource } = build({ lapsed: [] });
    dataSource.query.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('logo_url AS logoUrl')
          ? [
              {
                id: 1,
                name: 'Klinik',
                logoUrl: null,
                purgedAt: null,
                deleteAfter: '2026-01-01',
              },
            ]
          : [],
      ),
    );
    await expect(service.purge(1, 5, { force: true })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
