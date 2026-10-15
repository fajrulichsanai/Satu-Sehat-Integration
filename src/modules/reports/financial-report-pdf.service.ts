import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { FinancialReportQueryDto } from './dto/report.dto';
import { ProfitLossService, type ProfitLoss } from './profit-loss.service';
import {
  ACCENT,
  INK,
  MUTED,
  NEG,
  Node,
  SOFT,
  header,
  kpis,
  periodeLabel,
  render,
  rp,
  section,
  table,
  tanggalPanjang,
  tanggalPendek,
} from '../../common/pdf/report-kit';

const METODE: Record<string, string> = {
  cash: 'Tunai',
  transfer: 'Transfer',
  qris: 'QRIS',
  insurance: 'Asuransi',
  bpjs: 'BPJS',
};

const minus = (n: number) => (n ? `(${rp(n)})` : rp(0));

/**
 * Laporan keuangan siap pakai: sekali unduh, owner bisa langsung membaca
 * laba rugi, mentransfer share fee & gaji, dan berbelanja stok yang menipis.
 * Semua angka berasal dari ProfitLossService (satu definisi).
 */
@Injectable()
export class FinancialReportPdfService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    private readonly profitLoss: ProfitLossService,
  ) {}

  async generate(
    clinicId: number,
    query: FinancialReportQueryDto,
  ): Promise<Buffer> {
    const [clinic, pl, trend] = await Promise.all([
      this.clinicRepository.findOne({ where: { id: clinicId } }),
      this.profitLoss.compute(clinicId, query.dateFrom, query.dateTo),
      this.profitLoss.trend(clinicId, query.dateTo, 6),
    ]);
    const periode = `${tanggalPanjang(query.dateFrom)} – ${tanggalPanjang(query.dateTo)}`;
    const content: Node[] = [
      ...header(clinic, 'Laporan Keuangan', `Periode ${periode}`),
      ...this.summary(pl),
      ...this.labaRugi(pl),
      ...this.payables(pl),
      ...this.shopping(pl),
      ...this.procedures(pl),
      ...this.cash(pl),
      ...this.expenses(pl),
      ...this.trendSection(trend),
      ...this.notes(clinic?.city ?? null),
    ];
    return render(
      content,
      `${clinic?.name ?? 'Klinik'} · Laporan Keuangan ${periode} · dibuat ${tanggalPanjang(new Date())} oleh ApexRecord`,
    );
  }

  private summary(pl: ProfitLoss): Node[] {
    return [
      kpis([
        { label: 'Pendapatan bersih', value: rp(pl.pendapatan.bersih) },
        { label: 'Laba kotor', value: rp(pl.labaKotor) },
        {
          label: `Laba bersih · margin ${pl.marginPersen}%`,
          value: rp(pl.labaBersih),
          tone: pl.labaBersih < 0 ? 'neg' : 'ok',
        },
      ]),
      kpis([
        { label: 'Kas masuk (pembayaran diterima)', value: rp(pl.kas.masuk) },
        { label: 'Piutang pasien (belum dibayar)', value: rp(pl.kas.piutang) },
        {
          label: 'Share fee dokter (perlu dibayar)',
          value: rp(pl.beban.shareFeeDokter),
        },
      ]),
      {
        text: `${pl.pendapatan.jumlahTagihan} transaksi · ${pl.tindakan.reduce((a, t) => a + t.qty, 0)} tindakan`,
        fontSize: 8.5,
        color: MUTED,
        margin: [0, 2, 0, 0],
      },
    ];
  }

  /** Laporan laba rugi bertingkat. */
  private labaRugi(pl: ProfitLoss): Node[] {
    const row = (
      label: string,
      value: string,
      o: {
        indent?: boolean;
        bold?: boolean;
        fill?: boolean;
        color?: string;
      } = {},
    ): Node[] => [
      {
        text: label,
        bold: o.bold,
        margin: [o.indent ? 14 : 0, 0, 0, 0],
        fillColor: o.fill ? SOFT : undefined,
        fontSize: 9,
      },
      {
        text: value,
        bold: o.bold,
        alignment: 'right',
        color: o.color,
        fillColor: o.fill ? SOFT : undefined,
        fontSize: 9,
      },
    ];
    const head = (label: string): Node[] => [
      {
        text: label,
        bold: true,
        color: MUTED,
        fontSize: 8,
        margin: [0, 4, 0, 0],
      },
      { text: '' },
    ];
    const body: Node[][] = [
      head('PENDAPATAN'),
      row(
        'Pendapatan tindakan (harga jual × qty)',
        rp(pl.pendapatan.tindakanBruto),
        { indent: true },
      ),
      row('Diskon per tindakan', minus(pl.pendapatan.diskonTindakan), {
        indent: true,
      }),
      row('Diskon tagihan', minus(pl.pendapatan.diskonTagihan), {
        indent: true,
      }),
      row('Biaya tambahan', rp(pl.pendapatan.biayaTambahan), { indent: true }),
      row('Pendapatan bersih', rp(pl.pendapatan.bersih), {
        bold: true,
        fill: true,
      }),
      head('HARGA POKOK TINDAKAN'),
      row('Modal bahan (BMHP)', minus(pl.hpp.modalBahan), { indent: true }),
      row('Biaya lab', minus(pl.hpp.biayaLab), { indent: true }),
      row('Laba kotor', rp(pl.labaKotor), { bold: true, fill: true }),
      head('BEBAN'),
      row(
        'Share fee dokter (setelah potong biaya lab)',
        minus(pl.beban.shareFeeDokter),
        { indent: true },
      ),
      row('Gaji & honor', minus(pl.beban.gaji), { indent: true }),
      ...pl.beban.operasional.map((o) =>
        row(o.label, minus(o.total), { indent: true }),
      ),
      row('Total beban', minus(pl.beban.total), { bold: true }),
    ];
    return [
      section(
        '1. Laba Rugi',
        'Pendapatan dihitung dari tagihan pada periode ini (tidak termasuk tagihan batal/refund).',
      ),
      {
        table: { widths: ['*', 110], body },
        layout: {
          hLineWidth: (i: number, node: Node) =>
            i === node.table.body.length ? 0 : 0.4,
          vLineWidth: () => 0,
          hLineColor: () => '#EEF0F5',
          paddingTop: () => 3,
          paddingBottom: () => 3,
        },
      },
      {
        table: {
          widths: ['*', 110],
          body: [
            [
              {
                text: 'LABA BERSIH',
                bold: true,
                fontSize: 11,
                color: '#FFFFFF',
                fillColor: INK,
                margin: [4, 5, 0, 5],
              },
              {
                text: rp(pl.labaBersih),
                bold: true,
                fontSize: 11,
                color: '#FFFFFF',
                fillColor: pl.labaBersih < 0 ? NEG : ACCENT,
                alignment: 'right',
                margin: [0, 5, 4, 5],
              },
            ],
          ],
        },
        layout: 'noBorders',
        margin: [0, 4, 0, 0],
      },
    ];
  }

  /** Yang perlu ditransfer: share fee per dokter (dengan rekening), gaji, biaya lab. */
  private payables(pl: ProfitLoss): Node[] {
    const labRows = pl.tindakan.filter((t) => t.biayaLab > 0);
    const payroll = pl.payroll;
    return [
      section('2. Yang Perlu Dibayar', 'Daftar transfer periode ini.'),
      {
        text: 'a. Share fee dokter',
        bold: true,
        fontSize: 9.5,
        margin: [0, 2, 0, 4],
      },
      table(
        [
          { text: 'Dokter' },
          { text: 'Tindakan', right: true },
          { text: 'Pendapatan', right: true },
          { text: 'Biaya lab', right: true },
          { text: 'Share fee', right: true },
          { text: 'Rekening', width: 110 },
        ],
        pl.dokter.map((d) => [
          d.nama,
          String(d.tindakan),
          rp(d.pendapatan),
          d.biayaLab ? minus(d.biayaLab) : '-',
          { text: rp(d.shareFee), bold: true },
          d.bankAccount
            ? {
                stack: [
                  `${d.bankName ?? ''} ${d.bankAccount}`.trim(),
                  {
                    text: d.bankHolder ? `a.n. ${d.bankHolder}` : '',
                    color: MUTED,
                    fontSize: 7.5,
                  },
                ],
              }
            : {
                text: 'Isi di menu Penggajian',
                color: MUTED,
                italics: true,
                fontSize: 7.5,
              },
        ]),
        {
          empty: 'Tidak ada share fee pada periode ini',
          total: pl.dokter.length
            ? [
                'Total',
                String(pl.dokter.reduce((a, d) => a + d.tindakan, 0)),
                rp(pl.dokter.reduce((a, d) => a + d.pendapatan, 0)),
                minus(
                  pl.hpp.biayaLab &&
                    pl.dokter.reduce((a, d) => a + d.biayaLab, 0),
                ),
                rp(pl.beban.shareFeeDokter),
                '',
              ]
            : undefined,
        },
      ),
      {
        text: 'b. Gaji pegawai',
        bold: true,
        fontSize: 9.5,
        margin: [0, 6, 0, 4],
      },
      payroll
        ? {
            text: [
              `Payroll ${periodeLabel(payroll.period)} — ${payroll.status === 'paid' ? 'SUDAH DIBAYAR' : 'draft, belum dibayar'}: `,
              { text: rp(payroll.total), bold: true },
              ` untuk ${payroll.pegawai} pegawai (gaji pokok + bonus − potongan ${rp(payroll.gaji)}, share fee dokter ${rp(payroll.shareFee)}). Nama, rekening, dan nominal per orang ada di PDF Rekap Gaji (menu Penggajian).`,
            ],
            fontSize: 9,
          }
        : {
            text: 'Belum ada payroll untuk periode ini (atau periode laporan lebih dari satu bulan). Buat di menu Operasional › Penggajian untuk mendapat daftar transfer gaji lengkap dengan rekening.',
            fontSize: 9,
            color: MUTED,
          },
      {
        text: 'c. Biaya lab (dibayar ke laboratorium)',
        bold: true,
        fontSize: 9.5,
        margin: [0, 8, 0, 4],
      },
      table(
        [
          { text: 'Tindakan' },
          { text: 'Qty', right: true },
          { text: 'Biaya lab', right: true },
        ],
        labRows.map((t) => [t.nama, String(t.qty), rp(t.biayaLab)]),
        {
          empty: 'Tidak ada tindakan dengan biaya lab',
          total: labRows.length
            ? ['Total', '', rp(pl.hpp.biayaLab)]
            : undefined,
        },
      ),
    ];
  }

  /** Belanja tercatat + stok yang perlu dibeli. */
  private shopping(pl: ProfitLoss): Node[] {
    const totalEstimasi = pl.stokPerluBeli.reduce((a, s) => a + s.estimasi, 0);
    return [
      section(
        '3. Belanja & Stok',
        'Belanja bahan/alat/aset adalah uang keluar, bukan beban laba rugi (bahan sudah dihitung lewat modal per tindakan).',
      ),
      table(
        [
          { text: 'Belanja tercatat periode ini' },
          { text: 'Jumlah', right: true },
        ],
        pl.belanja.rincian.map((b) => [b.label, rp(b.total)]),
        {
          empty: 'Tidak ada belanja bahan/alat tercatat',
          total: pl.belanja.rincian.length
            ? ['Total belanja', rp(pl.belanja.total)]
            : undefined,
        },
      ),
      {
        text: 'Stok perlu dibeli (di bawah stok minimum)',
        bold: true,
        fontSize: 9.5,
        margin: [0, 6, 0, 4],
      },
      table(
        [
          { text: 'Barang' },
          { text: 'Stok', right: true },
          { text: 'Minimum', right: true },
          { text: 'Saran beli', right: true },
          { text: 'Estimasi biaya', right: true },
          { text: 'Supplier', width: 90 },
        ],
        pl.stokPerluBeli.map((s) => [
          s.nama,
          `${s.stok} ${s.satuan}`,
          String(s.minimum),
          `${s.saranBeli} ${s.satuan}`,
          rp(s.estimasi),
          s.supplier ?? '-',
        ]),
        {
          empty: 'Semua stok aman',
          total: pl.stokPerluBeli.length
            ? ['Total estimasi', '', '', '', rp(totalEstimasi), '']
            : undefined,
        },
      ),
    ];
  }

  private procedures(pl: ProfitLoss): Node[] {
    const s = (f: (t: ProfitLoss['tindakan'][number]) => number) =>
      pl.tindakan.reduce((a, t) => a + f(t), 0);
    return [
      section(
        '4. Kinerja per Tindakan',
        'Laba = pendapatan (setelah diskon) − modal bahan − biaya lab − share fee dokter.',
      ),
      table(
        [
          { text: 'Tindakan' },
          { text: 'Qty', right: true },
          { text: 'Harga jual', right: true },
          { text: 'Pendapatan', right: true },
          { text: 'Modal', right: true },
          { text: 'Lab', right: true },
          { text: 'Share fee', right: true },
          { text: 'Laba', right: true },
        ],
        pl.tindakan.map((t) => [
          t.nama,
          String(t.qty),
          rp(t.hargaRata),
          rp(t.pendapatan),
          rp(t.modal),
          rp(t.biayaLab),
          rp(t.shareFee),
          { text: rp(t.laba), bold: true, color: t.laba < 0 ? NEG : INK },
        ]),
        {
          empty: 'Belum ada tindakan',
          total: pl.tindakan.length
            ? [
                'Total',
                String(s((t) => t.qty)),
                '',
                rp(s((t) => t.pendapatan)),
                rp(s((t) => t.modal)),
                rp(s((t) => t.biayaLab)),
                rp(s((t) => t.shareFee)),
                rp(s((t) => t.laba)),
              ]
            : undefined,
        },
      ),
    ];
  }

  private cash(pl: ProfitLoss): Node[] {
    return [
      section(
        '5. Arus Kas',
        'Kas masuk = pembayaran yang diterima pada periode ini (termasuk pelunasan tagihan lama).',
      ),
      table(
        [{ text: 'Uraian' }, { text: 'Jumlah', right: true }],
        [
          ...pl.kas.perMetode.map((m) => [
            `Kas masuk · ${METODE[m.method] ?? m.method}`,
            rp(m.amount),
          ]),
          [
            { text: 'Total kas masuk', bold: true },
            { text: rp(pl.kas.masuk), bold: true },
          ],
          [
            'Pengeluaran tercatat (operasional, gaji, belanja)',
            minus(pl.kas.keluar - pl.beban.shareFeeDokter),
          ],
          ['Share fee dokter', minus(pl.beban.shareFeeDokter)],
          [
            { text: 'Selisih kas', bold: true },
            {
              text: rp(pl.kas.selisih),
              bold: true,
              color: pl.kas.selisih < 0 ? NEG : INK,
            },
          ],
          ['Piutang pasien dari tagihan periode ini', rp(pl.kas.piutang)],
          ...(pl.kas.refund
            ? [['Refund ke pasien', minus(pl.kas.refund)]]
            : []),
        ],
      ),
    ];
  }

  private expenses(pl: ProfitLoss): Node[] {
    return [
      section('6. Rincian Pengeluaran'),
      table(
        [
          { text: 'Tanggal', width: 62 },
          { text: 'Kategori', width: 110 },
          { text: 'Keterangan' },
          { text: 'Nominal', right: true },
        ],
        pl.pengeluaran.map((e) => [
          tanggalPendek(e.tanggal),
          e.label,
          e.deskripsi,
          rp(e.nominal),
        ]),
        {
          empty: 'Tidak ada pengeluaran tercatat',
          total: pl.pengeluaran.length
            ? [
                '',
                '',
                'Total',
                rp(pl.pengeluaran.reduce((a, e) => a + e.nominal, 0)),
              ]
            : undefined,
        },
      ),
    ];
  }

  private trendSection(
    trend: Awaited<ReturnType<ProfitLossService['trend']>>,
  ): Node[] {
    return [
      section('7. Tren 6 Bulan', 'Definisi sama dengan laba rugi di atas.'),
      table(
        [
          { text: 'Bulan' },
          { text: 'Pendapatan', right: true },
          { text: 'HPP', right: true },
          { text: 'Beban', right: true },
          { text: 'Laba bersih', right: true },
        ],
        trend.map((m) => [
          periodeLabel(m.month),
          rp(m.revenue),
          rp(m.modal),
          rp(m.expense),
          {
            text: rp(m.netProfit),
            bold: true,
            color: m.netProfit < 0 ? NEG : INK,
          },
        ]),
      ),
    ];
  }

  private notes(city: string | null): Node[] {
    return [
      {
        stack: [
          { text: 'Catatan', bold: true, fontSize: 8.5, margin: [0, 0, 0, 2] },
          {
            ul: [
              'Modal bahan & biaya lab memakai nilai saat transaksi dibuat, jadi perubahan tarif tidak mengubah laporan lama.',
              'Share fee persentase dihitung dari harga tindakan dikurangi biaya lab; konfigurasi fee yang nonaktif tidak dihitung.',
              'Angka dalam kurung adalah pengurang.',
            ],
            fontSize: 8,
            color: MUTED,
          },
        ],
        margin: [0, 14, 0, 0],
        unbreakable: true,
      },
      {
        columns: [
          {
            width: '*',
            stack: [
              {
                text: 'Disusun oleh,',
                fontSize: 9,
                alignment: 'center',
                margin: [0, 0, 0, 40],
              },
              {
                text: '( ............................ )',
                fontSize: 9,
                alignment: 'center',
              },
            ],
          },
          {
            width: '*',
            stack: [
              {
                text: `${city ? `${city}, ` : ''}${tanggalPanjang(new Date())}`,
                fontSize: 9,
                alignment: 'center',
              },
              {
                text: 'Disetujui oleh,',
                fontSize: 9,
                alignment: 'center',
                margin: [0, 0, 0, 30],
              },
              { text: '( Owner )', fontSize: 9, alignment: 'center' },
            ],
          },
        ],
        margin: [0, 20, 0, 0],
        unbreakable: true,
      },
    ];
  }
}
