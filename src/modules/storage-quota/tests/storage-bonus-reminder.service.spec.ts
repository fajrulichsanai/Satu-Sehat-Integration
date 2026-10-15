import { StorageBonusReminderService } from '../storage-bonus-reminder.service';
import { Resend } from 'resend';

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'mock' }) },
  })),
}));

describe('StorageBonusReminderService', () => {
  const sent = () =>
    (Resend as unknown as jest.Mock).mock.results.at(-1)!.value.emails
      .send as jest.Mock;
  let ds: { query: jest.Mock };
  let service: StorageBonusReminderService;

  beforeEach(() => {
    ds = { query: jest.fn() };
    service = new StorageBonusReminderService(
      ds as any,
      { get: (_k: string, d?: string) => d ?? 'k' } as any,
    );
  });

  it('emails who pays, once, a week before a bonus stops being free (positive)', async () => {
    ds.query
      .mockResolvedValueOnce([
        { id: 4, gb: 3, freeUntil: '2027-01-14', clinicId: 9, ownerId: null },
      ])
      .mockResolvedValueOnce([{ email: 'owner@klinik.id' }])
      .mockResolvedValueOnce({ affectedRows: 1 });

    const count = await service.remindEndingBonuses(new Date(2027, 0, 7));

    expect(count).toBe(1);
    expect(ds.query.mock.calls[0][1]).toEqual(['2027-01-07', '2027-01-14']);
    const mail = sent().mock.calls[0][0];
    expect(mail.to).toEqual(['owner@klinik.id']);
    expect(mail.html).toContain('30.000');
    expect(mail.html).toContain('/langganan');
    expect(ds.query.mock.calls[2][0]).toContain('reminded_at = NOW()');
  });

  it('sends the pool bonus reminder to the multiklinik owner (positive)', async () => {
    ds.query
      .mockResolvedValueOnce([
        { id: 5, gb: 2, freeUntil: '2027-01-14', clinicId: null, ownerId: 20 },
      ])
      .mockResolvedValueOnce([{ email: 'mco@x.id' }])
      .mockResolvedValueOnce({});
    await service.remindEndingBonuses(new Date(2027, 0, 7));
    expect(ds.query.mock.calls[1][1]).toEqual([20]);
    expect(sent().mock.calls[0][0].html).toContain('/multi-klinik/langganan');
  });

  it('does not mark a bonus reminded when nobody can receive it (negative)', async () => {
    ds.query
      .mockResolvedValueOnce([
        { id: 6, gb: 1, freeUntil: '2027-01-14', clinicId: 9, ownerId: null },
      ])
      .mockResolvedValueOnce([]);
    expect(await service.remindEndingBonuses(new Date(2027, 0, 7))).toBe(0);
    expect(ds.query).toHaveBeenCalledTimes(2);
  });
});
