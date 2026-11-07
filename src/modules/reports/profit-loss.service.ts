import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SHARE_FEE_JOIN, SHARE_FEE_SELECT, computeShareFee } from './share-fee';

/** Label kategori pengeluaran (cerminan lib/operational.ts di frontend). */
export const KATEGORI_LABEL: Record<string, string> = {
  listrik: 'Listrik',
  air: 'Air',
  atk: 'ATK & Perlengkapan',
  maintenance: 'Maintenance & Perbaikan',
  gaji: 'Gaji & Honor',
  sewa: 'Sewa Tempat',
  internet: 'Internet & Komunikasi',
  bahan_habis_pakai: 'Beli Bahan Habis Pakai',
  alat_dental: 'Beli Alat Dental',
  biaya_iklan: 'Biaya Iklan Klinik',
  barang_investasi: 'Beli Barang Investasi',
  barang_hiburan: 'Beli Barang Hiburan',
  lainnya: 'Lainnya',
};

/**
 * Belanja persediaan & aset: uang keluar, tapi BUKAN beban laba rugi —
 * bahan sudah dibebankan lewat modal per tindakan (HPP) saat dipakai, dan
 * alat/aset dipakai bertahun-tahun. Dicatat di bagian arus kas.
 */
export const KATEGORI_BELANJA = new Set([
  'bahan_habis_pakai',
  'alat_dental',
  'barang_investasi',
]);

const BILLED = `b.status NOT IN ('cancelled', 'refunded')`;
const num = (v: unknown) => Number(v ?? 0) || 0;

export interface Line {
  kategori: string;
  label: string;
  total: number;
}

export interface ProfitLoss {
  periode: { dateFrom: string; dateTo: string };
  pendapatan: {
    tindakanBruto: number;
    diskonTindakan: number;
    diskonTagihan: number;
    biayaTambahan: number;
    bersih: number;
    jumlahTagihan: number;
  };
  hpp: { modalBahan: number; biayaLab: number; total: number };
  labaKotor: number;
  beban: {
    shareFeeDokter: number;
    gaji: number;
    operasional: Line[];
    totalOperasional: number;
    total: number;
  };
  labaBersih: number;
  marginPersen: number;
  belanja: { rincian: Line[]; total: number };
  kas: {
    masuk: number;
    perMetode: { method: string; amount: number }[];
    keluar: number;
    selisih: number;
    piutang: number;
    refund: number;
  };
  dokter: {
    practitionerId: number;
    nama: string;
    tindakan: number;
    pendapatan: number;
    biayaLab: number;
    dasarFee: number;
    shareFee: number;
    bankName: string | null;
    bankAccount: string | null;
    bankHolder: string | null;
  }[];
  tindakan: {
    tarifId: number | null;
    nama: string;
    kategori: string | null;
    qty: number;
    hargaRata: number;
    bruto: number;
    diskon: number;
    pendapatan: number;
    modal: number;
    biayaLab: number;
    shareFee: number;
    laba: number;
  }[];
  pengeluaran: {
    tanggal: string;
    kategori: string;
    label: string;
    deskripsi: string;
    nominal: number;
  }[];
  stokPerluBeli: {
    nama: string;
    satuan: string;
    stok: number;
    minimum: number;
    saranBeli: number;
    estimasi: number;
    supplier: string | null;
  }[];
  payroll: {
    period: string;
    status: string;
    total: number;
    gaji: number;
    shareFee: number;
    pegawai: number;
  } | null;
}

/**
 * Laba rugi klinik dengan SATU definisi, dipakai halaman laporan, PDF, dan
 * tren bulanan:
 *
 *   Pendapatan bersih (total tagihan, tidak termasuk batal/refund)
 * − HPP (modal bahan + biaya lab per tindakan, snapshot saat transaksi)
 * = Laba kotor
 * − Beban (share fee dokter + gaji + operasional rutin)
 * = Laba bersih
 *
 * Belanja bahan/alat/aset dan kas masuk dilaporkan terpisah (arus kas),
 * supaya bahan tidak terhitung dua kali (sudah ada di HPP).
 */
@Injectable()
export class ProfitLossService {
  constructor(private readonly dataSource: DataSource) {}

  private q<T = Record<string, unknown>>(sql: string, params: unknown[]) {
    return this.dataSource.query(sql, params) as Promise<T[]>;
  }

  async compute(
    clinicId: number,
    dateFrom: string,
    dateTo: string,
    opts: { detail?: boolean } = {},
  ): Promise<ProfitLoss> {
    const detail = opts.detail !== false;
    const range = [clinicId, dateFrom, dateTo];
    const inRange = `b.clinic_id = ? AND DATE(b.created_at) BETWEEN ? AND ?`;

    const [billRows, itemRows, shareRows, opRows, payRows, refundRows] =
      await Promise.all([
        this.q(
          `SELECT COUNT(*) AS n, SUM(b.grand_total) AS bersih,
             SUM(b.total_discount) AS diskonTagihan,
             SUM(b.additional_fee) AS biayaTambahan,
             SUM(b.outstanding_amount) AS piutang
           FROM billings b WHERE ${inRange} AND ${BILLED}`,
          range,
        ),
        this.q(
          `SELECT bi.tarif_id AS tarifId,
             COALESCE(t.name, bi.name) AS nama,
             t.kategori AS kategori,
             SUM(bi.quantity) AS qty,
             SUM(bi.quantity * bi.unit_price) AS bruto,
             SUM(bi.quantity * bi.unit_price - bi.subtotal) AS diskon,
             SUM(COALESCE(bi.subtotal * (b.grand_total / NULLIF(b.subtotal, 0)), 0)) AS pendapatan,
             SUM(bi.quantity * COALESCE(bi.harga_pokok, t.harga_pokok, 0)) AS modal,
             SUM(bi.quantity * COALESCE(bi.biaya_lab, t.biaya_lab, 0)) AS lab
           FROM billing_items bi
           JOIN billings b ON bi.billing_id = b.id
           LEFT JOIN tarifs t ON bi.tarif_id = t.id
           WHERE ${inRange} AND ${BILLED}
           GROUP BY bi.tarif_id, COALESCE(t.name, bi.name), t.kategori
           ORDER BY pendapatan DESC`,
          range,
        ),
        this.q(
          `SELECT pr.id AS practitionerId, pr.name AS practitionerName,
             t.id AS tarifId,
             SUM(COALESCE(bi.subtotal * (b.grand_total / NULLIF(b.subtotal, 0)), 0)) AS revenue,${SHARE_FEE_SELECT}
           FROM billing_items bi
           JOIN billings b ON bi.billing_id = b.id
           JOIN encounters e ON b.encounter_id = e.id
           JOIN practitioners pr ON e.practitioner_id = pr.id
           JOIN tarifs t ON bi.tarif_id = t.id${SHARE_FEE_JOIN}
           WHERE ${inRange} AND ${BILLED}
           GROUP BY pr.id, pr.name, t.id, dfc.fee_type, dfc.fee_value`,
          range,
        ),
        this.q(
          `SELECT kategori, SUM(nominal) AS total FROM operational_records
           WHERE clinic_id = ? AND tanggal BETWEEN ? AND ?
           GROUP BY kategori ORDER BY total DESC`,
          range,
        ),
        this.q(
          `SELECT p.method, SUM(p.amount) AS amount
           FROM payments p JOIN billings b ON p.billing_id = b.id
           WHERE b.clinic_id = ? AND DATE(p.paid_at) BETWEEN ? AND ?
             AND b.status != 'cancelled'
           GROUP BY p.method ORDER BY amount DESC`,
          range,
        ),
        this.q(
          `SELECT SUM(b.paid_amount) AS refund FROM billings b
           WHERE ${inRange} AND b.status = 'refunded'`,
          range,
        ),
      ]);

    const bill = billRows[0] ?? {};
    const sum = <T>(rows: T[], f: (r: T) => number) =>
      rows.reduce((a, r) => a + f(r), 0);

    // Share fee per dokter & per tarif dari helper yang sama dengan halaman Share Fee / Payroll
    const doctorMap = new Map<number, ProfitLoss['dokter'][number]>();
    const sharePerTarif = new Map<number, number>();
    for (const r of shareRows as any[]) {
      const fee = computeShareFee(r);
      const id = Number(r.practitionerId);
      const d = doctorMap.get(id) ?? {
        practitionerId: id,
        nama: String(r.practitionerName),
        tindakan: 0,
        pendapatan: 0,
        biayaLab: 0,
        dasarFee: 0,
        shareFee: 0,
        bankName: null,
        bankAccount: null,
        bankHolder: null,
      };
      d.tindakan += fee.count;
      d.pendapatan += num(r.revenue);
      d.biayaLab += fee.totalBiayaLab;
      d.dasarFee += fee.feeType === 'fixed' ? 0 : fee.dasarFee;
      d.shareFee += fee.totalShare;
      doctorMap.set(id, d);
      const tid = Number(r.tarifId);
      sharePerTarif.set(tid, (sharePerTarif.get(tid) ?? 0) + fee.totalShare);
    }
    const dokter = [...doctorMap.values()].sort(
      (a, b) => b.shareFee - a.shareFee,
    );

    const tindakan = (itemRows as any[]).map((r) => {
      const qty = num(r.qty);
      const bruto = num(r.bruto);
      const pendapatan = num(r.pendapatan);
      const modal = num(r.modal);
      const biayaLab = num(r.lab);
      const shareFee = r.tarifId
        ? (sharePerTarif.get(Number(r.tarifId)) ?? 0)
        : 0;
      return {
        tarifId: r.tarifId ? Number(r.tarifId) : null,
        nama: String(r.nama),
        kategori: r.kategori ?? null,
        qty,
        hargaRata: qty ? bruto / qty : 0,
        bruto,
        diskon: num(r.diskon),
        pendapatan,
        modal,
        biayaLab,
        shareFee,
        laba: pendapatan - modal - biayaLab - shareFee,
      };
    });

    const pendapatanBersih = num(bill.bersih);
    const modalBahan = sum(tindakan, (t) => t.modal);
    const biayaLab = sum(tindakan, (t) => t.biayaLab);
    const hppTotal = modalBahan + biayaLab;
    const labaKotor = pendapatanBersih - hppTotal;

    const line = (r: any): Line => ({
      kategori: String(r.kategori),
      label: KATEGORI_LABEL[r.kategori] ?? String(r.kategori),
      total: num(r.total),
    });
    const ops = (opRows as any[]).map(line);
    const gaji = sum(
      ops.filter((o) => o.kategori === 'gaji'),
      (o) => o.total,
    );
    const operasional = ops.filter(
      (o) => o.kategori !== 'gaji' && !KATEGORI_BELANJA.has(o.kategori),
    );
    const belanja = ops.filter((o) => KATEGORI_BELANJA.has(o.kategori));
    const totalOperasional = sum(operasional, (o) => o.total);
    const shareFeeDokter = sum(dokter, (d) => d.shareFee);
    const bebanTotal = shareFeeDokter + gaji + totalOperasional;
    const labaBersih = labaKotor - bebanTotal;
    const belanjaTotal = sum(belanja, (o) => o.total);

    const perMetode = (payRows as any[]).map((r) => ({
      method: String(r.method),
      amount: num(r.amount),
    }));
    const kasMasuk = sum(perMetode, (p) => p.amount);
    // Kas keluar yang tercatat: semua pengeluaran operasional (termasuk gaji &
    // belanja) + share fee dokter (dibayar lewat payroll / transfer langsung).
    const kasKeluar = sum(ops, (o) => o.total) + shareFeeDokter;

    const result: ProfitLoss = {
      periode: { dateFrom, dateTo },
      pendapatan: {
        tindakanBruto: sum(tindakan, (t) => t.bruto),
        diskonTindakan: sum(tindakan, (t) => t.diskon),
        diskonTagihan: num(bill.diskonTagihan),
        biayaTambahan: num(bill.biayaTambahan),
        bersih: pendapatanBersih,
        jumlahTagihan: num(bill.n),
      },
      hpp: { modalBahan, biayaLab, total: hppTotal },
      labaKotor,
      beban: {
        shareFeeDokter,
        gaji,
        operasional,
        totalOperasional,
        total: bebanTotal,
      },
      labaBersih,
      marginPersen:
        pendapatanBersih > 0
          ? Math.round((labaBersih / pendapatanBersih) * 1000) / 10
          : 0,
      belanja: { rincian: belanja, total: belanjaTotal },
      kas: {
        masuk: kasMasuk,
        perMetode,
        keluar: kasKeluar,
        selisih: kasMasuk - kasKeluar,
        piutang: num(bill.piutang),
        refund: num(refundRows[0]?.refund),
      },
      dokter,
      tindakan,
      pengeluaran: [],
      stokPerluBeli: [],
      payroll: null,
    };

    if (!detail) return result;

    const [bankRows, expenseRows, stockRows, payrollRows] = await Promise.all([
      this.q(
        `SELECT u.practitioner_id AS practitionerId, es.bank_name AS bankName,
           es.bank_account AS bankAccount, es.bank_holder AS bankHolder
         FROM users u
         JOIN employee_salaries es ON es.user_id = u.id AND es.clinic_id = u.clinic_id
         WHERE u.clinic_id = ? AND u.practitioner_id IS NOT NULL`,
        [clinicId],
      ),
      this.q(
        `SELECT DATE_FORMAT(tanggal, '%Y-%m-%d') AS tanggal, kategori, deskripsi, nominal
         FROM operational_records
         WHERE clinic_id = ? AND tanggal BETWEEN ? AND ?
         ORDER BY tanggal ASC, id ASC`,
        range,
      ),
      this.q(
        `SELECT name, satuan_pakai AS satuan, stok_saat_ini AS stok,
           stok_minimum AS minimum, harga_beli AS hargaBeli,
           supplier_name AS supplier
         FROM barang
         WHERE clinic_id = ? AND is_active = 1 AND stok_minimum > 0
           AND stok_saat_ini <= stok_minimum
         ORDER BY (stok_saat_ini / stok_minimum) ASC, name ASC`,
        [clinicId],
      ),
      dateFrom.slice(0, 7) === dateTo.slice(0, 7)
        ? this.q(
            `SELECT r.period, r.status,
               SUM(i.base_salary + i.bonus + i.share_fee - i.deduction) AS total,
               SUM(i.base_salary + i.bonus - i.deduction) AS gaji,
               SUM(i.share_fee) AS shareFee, COUNT(i.id) AS pegawai
             FROM payroll_runs r LEFT JOIN payroll_items i ON i.run_id = r.id
             WHERE r.clinic_id = ? AND r.period = ?
             GROUP BY r.id, r.period, r.status`,
            [clinicId, dateFrom.slice(0, 7)],
          )
        : Promise.resolve([]),
    ]);

    const bank = new Map(
      (bankRows as any[]).map((b) => [Number(b.practitionerId), b]),
    );
    for (const d of result.dokter) {
      const b = bank.get(d.practitionerId);
      if (b) {
        d.bankName = b.bankName ?? null;
        d.bankAccount = b.bankAccount ?? null;
        d.bankHolder = b.bankHolder ?? null;
      }
    }
    result.pengeluaran = (expenseRows as any[]).map((r) => ({
      tanggal: String(r.tanggal),
      kategori: String(r.kategori),
      label: KATEGORI_LABEL[r.kategori] ?? String(r.kategori),
      deskripsi: String(r.deskripsi ?? ''),
      nominal: num(r.nominal),
    }));
    result.stokPerluBeli = (stockRows as any[]).map((r) => {
      const stok = num(r.stok);
      const minimum = num(r.minimum);
      // Saran: isi ulang sampai 2x stok minimum
      const saranBeli = Math.max(minimum * 2 - stok, 0);
      return {
        nama: String(r.name),
        satuan: String(r.satuan ?? ''),
        stok,
        minimum,
        saranBeli,
        estimasi: saranBeli * num(r.hargaBeli),
        supplier: r.supplier ?? null,
      };
    });
    const pr = (payrollRows as any[])[0];
    result.payroll = pr
      ? {
          period: String(pr.period),
          status: String(pr.status),
          total: num(pr.total),
          gaji: num(pr.gaji),
          shareFee: num(pr.shareFee),
          pegawai: num(pr.pegawai),
        }
      : null;
    return result;
  }

  /** Laba rugi ringkas per bulan, `count` bulan berakhir di bulan `anchor` (YYYY-MM-DD). */
  async trend(clinicId: number, anchor: string, count = 6) {
    const [y, m] = anchor.split('-').map(Number);
    const months: { key: string; from: string; to: string }[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const start = new Date(Date.UTC(y, m - 1 - i, 1));
      const end = new Date(Date.UTC(y, m - i, 0));
      months.push({
        key: start.toISOString().slice(0, 7),
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10),
      });
    }
    return Promise.all(
      months.map(async (mo) => {
        const pl = await this.compute(clinicId, mo.from, mo.to, {
          detail: false,
        });
        return {
          month: mo.key,
          revenue: pl.pendapatan.bersih,
          modal: pl.hpp.total,
          labaKotor: pl.labaKotor,
          expense: pl.beban.total,
          netProfit: pl.labaBersih,
        };
      }),
    );
  }
}
