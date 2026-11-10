import { BadRequestException, ConflictException } from '@nestjs/common';
import { PayrollService, itemGaji, itemTotal } from '../payroll.service';

describe('PayrollService', () => {
  const row = {
    baseSalary: 3000000,
    bonus: 500000,
    deduction: 100000,
    shareFee: 900000,
  };

  it('total = pokok + bonus + share fee - potongan', () => {
    expect(itemTotal(row)).toBe(4300000);
  });

  it('pengeluaran gaji tidak menghitung share fee (sudah di laporan)', () => {
    expect(itemGaji(row)).toBe(3400000);
  });

  const make = (run: unknown, item?: unknown) => {
    const runRepo = { findOne: jest.fn().mockResolvedValue(run) };
    const itemRepo = {
      findOne: jest.fn().mockResolvedValue(item),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
    };
    const svc = new PayrollService(
      { find: jest.fn().mockResolvedValue([]) } as never,
      runRepo as never,
      itemRepo as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { svc, itemRepo };
  };

  it('menolak periode tidak valid', async () => {
    const { svc } = make(null);
    await expect(svc.getRun(1, '2026-13')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('tidak bisa mengubah payroll yang sudah dibayar', async () => {
    const { svc } = make({ id: 1, status: 'paid' });
    await expect(
      svc.updateItem(1, '2026-10', 1, { bonus: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('menolak potongan melebihi total', async () => {
    const { svc, itemRepo } = make(
      { id: 1, status: 'draft' },
      {
        id: 1,
        runId: 1,
        baseSalary: 1000,
        bonus: 0,
        deduction: 0,
        shareFee: 0,
      },
    );
    await expect(
      svc.updateItem(1, '2026-10', 1, { deduction: 5000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(itemRepo.save).not.toHaveBeenCalled();
  });
});
