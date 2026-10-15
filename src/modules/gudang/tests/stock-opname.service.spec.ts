import { BadRequestException } from '@nestjs/common';
import { StockOpnameService } from '../stock-opname.service';
import { StokTransaksiType } from '../entities/stok-transaksi.entity';

describe('StockOpnameService', () => {
  function setup(barang: any[]) {
    const saved: any[] = [];
    const updates: any[] = [];
    const m = {
      find: jest.fn().mockResolvedValue(barang),
      findOne: jest.fn().mockResolvedValue({ id: 9, name: 'Admin' }),
      create: jest.fn((_e: unknown, data: any) => ({ ...data })),
      save: jest.fn(async (a: any, b?: any) => {
        const row = b ?? a;
        saved.push(row);
        return { id: 77, ...row };
      }),
      update: jest.fn(async (_e: unknown, _id: unknown, data: any) =>
        updates.push(data),
      ),
    };
    const ds = { transaction: (fn: (mm: typeof m) => unknown) => fn(m) };
    const opnameRepo = { findOne: jest.fn().mockResolvedValue({ id: 77 }) };
    const itemRepo = { find: jest.fn().mockResolvedValue([]) };
    const svc = new StockOpnameService(
      ds as never,
      opnameRepo as never,
      itemRepo as never,
    );
    return { svc, saved, updates };
  }

  it('membuat adjustment sebesar selisih dan menghitung nilai selisih', async () => {
    const kapas = { id: 1, name: 'Kapas', stokSaatIni: 50, hargaBeli: 500 };
    const komposit = {
      id: 2,
      name: 'Komposit',
      stokSaatIni: 3,
      hargaBeli: 350000,
    };
    const { svc, saved, updates } = setup([kapas, komposit]);
    await svc.create(
      5,
      {
        tanggal: '2026-10-15',
        items: [
          { barangId: 1, stokFisik: 42, catatan: 'rusak' },
          { barangId: 2, stokFisik: 3 },
        ],
      },
      9,
    );
    const adj = saved.filter((r) => r.type === StokTransaksiType.ADJUSTMENT);
    expect(adj).toHaveLength(1); // komposit tidak berubah → tanpa transaksi
    expect(adj[0]).toMatchObject({ barangId: 1, qty: -8 });
    expect(kapas.stokSaatIni).toBe(42);
    expect(updates[0]).toEqual({ totalSelisihNilai: -4000 });
    const items = saved.filter((r) => 'stokFisik' in r);
    expect(items.map((i) => i.selisih)).toEqual([-8, 0]);
  });

  it('menolak barang ganda', async () => {
    const { svc } = setup([]);
    await expect(
      svc.create(
        5,
        {
          tanggal: '2026-10-15',
          items: [
            { barangId: 1, stokFisik: 1 },
            { barangId: 1, stokFisik: 2 },
          ],
        },
        9,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
