import { ProfitLossService } from '../profit-loss.service';

describe('ProfitLossService', () => {
  function make(results: unknown[][]) {
    const query = jest.fn();
    for (const r of results) query.mockResolvedValueOnce(r);
    return { svc: new ProfitLossService({ query } as never), query };
  }

  it('laba rugi konsisten: pendapatan - HPP - beban; belanja bahan bukan beban', async () => {
    const { svc } = make([
      [
        {
          n: '3',
          bersih: '2900000',
          diskonTagihan: '100000',
          biayaTambahan: '0',
          piutang: '400000',
        },
      ],
      [
        {
          tarifId: 1,
          nama: 'Crown',
          kategori: 'Prosto',
          qty: '2',
          bruto: '3000000',
          diskon: '0',
          pendapatan: '2900000',
          modal: '400000',
          lab: '1000000',
        },
      ],
      [
        {
          practitionerId: 7,
          practitionerName: 'drg. B',
          tarifId: 1,
          revenue: '2900000',
          count: '2',
          totalHarga: '3000000',
          totalBiayaLab: '1000000',
          dasarFee: '2000000',
          feeType: 'percentage',
          feeValue: '30',
        },
      ],
      [
        { kategori: 'gaji', total: '500000' },
        { kategori: 'listrik', total: '100000' },
        { kategori: 'bahan_habis_pakai', total: '250000' },
      ],
      [{ method: 'cash', amount: '2500000' }],
      [{ refund: null }],
    ]);
    const pl = await svc.compute(1, '2026-10-01', '2026-10-31', {
      detail: false,
    });
    expect(pl.pendapatan.bersih).toBe(2900000);
    expect(pl.hpp).toEqual({
      modalBahan: 400000,
      biayaLab: 1000000,
      total: 1400000,
    });
    expect(pl.labaKotor).toBe(1500000);
    expect(pl.beban.shareFeeDokter).toBe(600000); // 30% x (3jt - 1jt lab)
    expect(pl.beban.gaji).toBe(500000);
    expect(pl.beban.totalOperasional).toBe(100000); // belanja bahan tidak masuk
    expect(pl.labaBersih).toBe(1500000 - 600000 - 500000 - 100000);
    expect(pl.belanja.total).toBe(250000);
    expect(pl.tindakan[0].laba).toBe(2900000 - 400000 - 1000000 - 600000);
    expect(pl.kas.masuk).toBe(2500000);
    expect(pl.kas.piutang).toBe(400000);
    expect(pl.marginPersen).toBe(10.3);
  });

  it('periode kosong menghasilkan nol tanpa NaN', async () => {
    const { svc } = make([[{}], [], [], [], [], [{}]]);
    const pl = await svc.compute(1, '2026-10-01', '2026-10-31', {
      detail: false,
    });
    expect(pl.labaBersih).toBe(0);
    expect(pl.marginPersen).toBe(0);
    expect(pl.dokter).toEqual([]);
  });

  it('tren memakai bulan yang berakhir di tanggal akhir laporan', async () => {
    const { svc } = make([]);
    const spy = jest.spyOn(svc, 'compute').mockResolvedValue({
      pendapatan: { bersih: 1 },
      hpp: { total: 0 },
      labaKotor: 1,
      beban: { total: 0 },
      labaBersih: 1,
    } as never);
    const t = await svc.trend(1, '2026-03-15', 3);
    expect(t.map((m) => m.month)).toEqual(['2026-01', '2026-02', '2026-03']);
    expect(spy).toHaveBeenCalledWith(1, '2026-02-01', '2026-02-28', {
      detail: false,
    });
  });
});
