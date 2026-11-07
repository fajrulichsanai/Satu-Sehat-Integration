import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PatientsService } from '../patients.service';
import { PatientHistoryQueryDto } from '../dto/patient.dto';

/** Query builder tiruan: semua method berantai, hasil akhir diatur per tes. */
const makeQb = (opts: { rows?: any[]; total?: number; raw?: any[][] }) => {
  const calls: Record<string, any[][]> = {};
  const rawQueue = [...(opts.raw ?? [])];
  const qb: any = new Proxy(
    {},
    {
      get: (_t, name: string) => {
        if (name === 'getManyAndCount')
          return async () => [opts.rows ?? [], opts.total ?? 0];
        if (name === 'getRawMany') return async () => rawQueue.shift() ?? [];
        if (name === 'calls') return calls;
        return (...args: any[]) => {
          (calls[name] ??= []).push(args);
          return qb;
        };
      },
    },
  );
  return qb;
};

const makeService = (encQb?: any, billQb?: any) => {
  const svc: any = Object.create(PatientsService.prototype);
  svc.findOne = jest.fn().mockResolvedValue({ id: 7 });
  svc.encounterRepository = { createQueryBuilder: jest.fn(() => encQb) };
  svc.billingRepository = { createQueryBuilder: jest.fn(() => billQb) };
  return svc as PatientsService & { findOne: jest.Mock };
};

const q = (o: Partial<PatientHistoryQueryDto> = {}) =>
  ({ page: 1, limit: 10, ...o }) as PatientHistoryQueryDto;

describe('PatientsService.findEncounterHistory', () => {
  it('maps rows, builds meta and returns months + visit days (positive)', async () => {
    const qb = makeQb({
      rows: [
        {
          id: 5,
          status: 'finished',
          serviceType: 'Scaling',
          chiefComplaint: 'Karang gigi',
          arrivedTime: new Date('2026-10-20T09:00:00'),
          finishedTime: null,
          practitioner: { name: 'Budi' },
        },
      ],
      total: 25,
      raw: [
        [
          { month: '2026-10', count: '25' },
          { month: '2026-09', count: '3' },
        ],
        [{ date: '2026-10-20', count: '2' }],
      ],
    });
    const svc = makeService(qb);

    const r = await svc.findEncounterHistory(
      7,
      1,
      q({ month: '2026-10', page: 2 }),
    );

    expect(svc.findOne).toHaveBeenCalledWith(7, 1);
    expect(r.items[0]).toMatchObject({ id: 5, practitionerName: 'Budi' });
    expect(r.meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
    expect(r.months).toEqual([
      { month: '2026-10', count: 25 },
      { month: '2026-09', count: 3 },
    ]);
    expect(r.days).toEqual([{ date: '2026-10-20', count: 2 }]);
  });

  it('pages with skip/take and filters by month only when given (positive)', async () => {
    const withMonth = makeQb({});
    await makeService(withMonth).findEncounterHistory(
      7,
      1,
      q({ month: '2026-10', page: 3, limit: 5 }),
    );
    expect(withMonth.calls.skip[0]).toEqual([10]);
    expect(withMonth.calls.take[0]).toEqual([5]);
    expect(JSON.stringify(withMonth.calls.andWhere)).toContain(':month');

    const noMonth = makeQb({});
    await makeService(noMonth).findEncounterHistory(7, 1, q());
    expect(noMonth.calls.andWhere).toBeUndefined();
  });

  it('returns empty page with zero pages when nothing matches (edge)', async () => {
    const r = await makeService(makeQb({})).findEncounterHistory(
      7,
      1,
      q({ month: '2020-01' }),
    );
    expect(r.items).toEqual([]);
    expect(r.meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
    expect(r.days).toEqual([]);
  });

  it('does not query history when the patient is not in this clinic (negative)', async () => {
    const qb = makeQb({});
    const svc = makeService(qb);
    svc.findOne.mockRejectedValue(new Error('Pasien tidak ditemukan'));
    await expect(svc.findEncounterHistory(7, 99, q())).rejects.toThrow(
      'Pasien tidak ditemukan',
    );
    expect(qb.calls.skip).toBeUndefined();
  });
});

describe('PatientsService.findBillingHistory', () => {
  it('maps invoice fields to numbers and lists item names (positive)', async () => {
    const qb = makeQb({
      rows: [
        {
          id: 3,
          invoiceNumber: 'INV-3',
          status: 'paid',
          grandTotal: '150000.00',
          paidAmount: '150000.00',
          outstandingAmount: '0.00',
          createdAt: new Date('2026-10-02T11:00:00'),
          encounterId: 9,
          items: [{ name: 'Scaling' }, { name: 'Tambal' }],
        },
      ],
      total: 1,
      raw: [
        [{ month: '2026-10', count: '1' }],
        [{ date: '2026-10-02', count: '1' }],
      ],
    });
    const r = await makeService(undefined, qb).findBillingHistory(
      7,
      1,
      q({ month: '2026-10' }),
    );
    expect(r.items[0]).toEqual({
      id: 3,
      invoiceNumber: 'INV-3',
      status: 'paid',
      grandTotal: 150000,
      paidAmount: 150000,
      outstandingAmount: 0,
      createdAt: new Date('2026-10-02T11:00:00'),
      encounterId: 9,
      itemNames: ['Scaling', 'Tambal'],
    });
    expect(r.meta.totalPages).toBe(1);
  });

  it('handles an invoice without items (edge)', async () => {
    const qb = makeQb({
      rows: [
        { id: 1, grandTotal: '0', paidAmount: '0', outstandingAmount: '0' },
      ],
      total: 1,
    });
    const r = await makeService(undefined, qb).findBillingHistory(7, 1, q());
    expect(r.items[0].itemNames).toEqual([]);
  });
});

describe('PatientHistoryQueryDto', () => {
  const errorsFor = async (body: object) =>
    JSON.stringify(
      await validate(plainToInstance(PatientHistoryQueryDto, body), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

  it('accepts a valid month with paging, and defaults page/limit (positive)', async () => {
    expect(await errorsFor({ month: '2026-10', page: '2', limit: '20' })).toBe(
      '[]',
    );
    const dto = plainToInstance(PatientHistoryQueryDto, {});
    expect([dto.page, dto.limit]).toEqual([1, 10]);
  });

  it('rejects bad month formats and out-of-range paging (negative)', async () => {
    for (const month of [
      '2026-13',
      '2026-00',
      '26-10',
      '2026/10',
      '2026-1',
      "2026-10' OR 1=1",
    ]) {
      expect(await errorsFor({ month })).toContain('month');
    }
    expect(await errorsFor({ page: 0 })).toContain('page');
    expect(await errorsFor({ limit: 51 })).toContain('limit');
  });
});
