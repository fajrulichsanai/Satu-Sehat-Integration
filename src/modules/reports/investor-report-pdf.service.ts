import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import { Clinic } from '../clinics/entities/clinic.entity';
import { ReportsService } from './reports.service';
// pdfmake's server build exports one process-wide singleton configured via
// setters (see prescription-pdf.service.ts / invoice.service.ts for the
// original setup). Node caches this module, so this top-level call runs
// once per process regardless of how many places import it — calling the
// same setters again from another module is harmless (same values).
import PdfMake = require('pdfmake');

const ROBOTO_DIR = path.join(
  require.resolve('pdfmake/package.json'),
  '..',
  'fonts',
  'Roboto',
);
PdfMake.setFonts({
  Roboto: {
    normal: path.join(ROBOTO_DIR, 'Roboto-Regular.ttf'),
    bold: path.join(ROBOTO_DIR, 'Roboto-Medium.ttf'),
    italics: path.join(ROBOTO_DIR, 'Roboto-Italic.ttf'),
    bolditalics: path.join(ROBOTO_DIR, 'Roboto-MediumItalic.ttf'),
  },
});
PdfMake.setLocalAccessPolicy(() => true);
PdfMake.setUrlAccessPolicy(() => false);

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function monthLabel(key: string): string {
  const [year, month] = key.split('-');
  return `${MONTH_LABELS[parseInt(month, 10) - 1]} ${year}`;
}

function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return '-';
  return `${value > 0 ? '+' : ''}${value}%`;
}

@Injectable()
export class InvestorReportPdfService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    private readonly reportsService: ReportsService,
  ) {}

  async generate(clinicId: number): Promise<Buffer> {
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });
    const data = await this.reportsService.getInvestorReportData(clinicId);
    const { summary, unitEconomics, monthly, categoryProfitability, byDoctor } =
      data;

    const generatedAtLabel = new Date(data.generatedAt).toLocaleDateString(
      'id-ID',
      { day: '2-digit', month: 'long', year: 'numeric' },
    );

    const growthLabel =
      summary.recentGrowthPercent === null
        ? 'belum dapat dihitung (data pembanding belum cukup)'
        : summary.recentGrowthPercent >= 0
          ? `naik ${summary.recentGrowthPercent}%`
          : `turun ${Math.abs(summary.recentGrowthPercent)}%`;
    const retentionLabel =
      unitEconomics.halfYearRetentionPercent === null
        ? 'belum dapat dihitung'
        : `${unitEconomics.halfYearRetentionPercent}%`;
    const marginNarrative =
      summary.avgMarginPercent >= 30
        ? 'mencerminkan efisiensi operasional yang sehat'
        : summary.avgMarginPercent >= 10
          ? 'berada pada level yang wajar, dengan ruang untuk efisiensi lebih lanjut'
          : 'masih tipis dan memerlukan perhatian pada struktur biaya';

    const cacSentence =
      unitEconomics.marketing.cac !== null
        ? ` Biaya akuisisi pasien baru (CAC) rata-rata ${formatRupiah(unitEconomics.marketing.cac)}${unitEconomics.marketing.ltvCacRatio !== null ? `, dengan rasio LTV:CAC sebesar ${unitEconomics.marketing.ltvCacRatio}x` : ''}.`
        : '';

    const avgMonthlyLabel =
      summary.activeMonths12mo < 12
        ? `dengan rata-rata ${formatRupiah(summary.avgMonthlyRevenue)} per bulan (dihitung dari ${summary.activeMonths12mo} bulan operasional dengan pendapatan tercatat, karena klinik belum genap 12 bulan berjalan)`
        : `dengan rata-rata ${formatRupiah(summary.avgMonthlyRevenue)} per bulan`;

    const narrative = `${clinic?.name || 'Klinik ini'} mencatatkan total pendapatan kumulatif sebesar ${formatRupiah(summary.totalRevenue12mo)} sepanjang 12 bulan terakhir, ${avgMonthlyLabel}. Pendapatan tiga bulan terakhir ${growthLabel} dibandingkan tiga bulan sebelumnya. Margin keuntungan bersih rata-rata tercatat ${summary.avgMarginPercent}%, yang ${marginNarrative}. Klinik melayani ${summary.totalPatients12mo} pasien unik dengan total ${summary.totalVisits12mo} kunjungan sepanjang periode ini, di mana ${summary.totalNewPatients12mo} di antaranya adalah pasien baru. Dari pasien yang bertransaksi pada paruh pertama periode, ${retentionLabel} kembali bertransaksi pada paruh kedua — mengindikasikan tingkat retensi pasien.${cacSentence}`;

    const monthlyTableBody: any[] = [
      [
        { text: 'Bulan', style: 'th' },
        { text: 'Pendapatan', style: 'th', alignment: 'right' },
        { text: 'Modal', style: 'th', alignment: 'right' },
        { text: 'Pengeluaran', style: 'th', alignment: 'right' },
        { text: 'Laba Bersih', style: 'th', alignment: 'right' },
        { text: 'Margin', style: 'th', alignment: 'right' },
        { text: 'Kunjungan', style: 'th', alignment: 'right' },
      ],
      ...monthly.map((m) => [
        { text: monthLabel(m.month), style: 'td' },
        { text: formatRupiah(m.revenue), style: 'td', alignment: 'right' },
        { text: formatRupiah(m.modal), style: 'td', alignment: 'right' },
        { text: formatRupiah(m.expense), style: 'td', alignment: 'right' },
        { text: formatRupiah(m.netProfit), style: 'td', alignment: 'right' },
        { text: `${m.marginPercent}%`, style: 'td', alignment: 'right' },
        { text: String(m.visits), style: 'td', alignment: 'right' },
      ]),
      [
        { text: 'Total', style: 'tdBold' },
        {
          text: formatRupiah(summary.totalRevenue12mo),
          style: 'tdBold',
          alignment: 'right',
        },
        {
          text: formatRupiah(monthly.reduce((s, m) => s + m.modal, 0)),
          style: 'tdBold',
          alignment: 'right',
        },
        {
          text: formatRupiah(monthly.reduce((s, m) => s + m.expense, 0)),
          style: 'tdBold',
          alignment: 'right',
        },
        {
          text: formatRupiah(summary.totalNetProfit12mo),
          style: 'tdBold',
          alignment: 'right',
        },
        {
          text: `${summary.avgMarginPercent}%`,
          style: 'tdBold',
          alignment: 'right',
        },
        {
          text: String(summary.totalVisits12mo),
          style: 'tdBold',
          alignment: 'right',
        },
      ],
    ];

    const categoryTableBody: any[] = [
      [
        { text: 'Kategori Tindakan', style: 'th' },
        { text: 'Frekuensi', style: 'th', alignment: 'right' },
        { text: 'Pendapatan', style: 'th', alignment: 'right' },
        { text: 'Laba Bersih', style: 'th', alignment: 'right' },
        { text: 'Margin', style: 'th', alignment: 'right' },
      ],
      ...(categoryProfitability.length
        ? categoryProfitability.map((c) => [
            { text: c.kategori, style: 'td' },
            { text: String(c.frekuensi), style: 'td', alignment: 'right' },
            {
              text: formatRupiah(c.pendapatan),
              style: 'td',
              alignment: 'right',
            },
            {
              text: formatRupiah(c.labaBersih),
              style: 'td',
              alignment: 'right',
            },
            { text: `${c.marginPersen}%`, style: 'td', alignment: 'right' },
          ])
        : [
            [
              {
                text: 'Belum ada data tindakan pada periode ini',
                style: 'td',
                colSpan: 5,
              },
              {},
              {},
              {},
              {},
            ],
          ]),
    ];

    const doctorTableBody: any[] = [
      [
        { text: 'Dokter', style: 'th' },
        { text: 'Pendapatan (12 Bulan)', style: 'th', alignment: 'right' },
      ],
      ...(byDoctor.length
        ? byDoctor.map((d) => [
            { text: d.practitionerName, style: 'td' },
            { text: formatRupiah(d.revenue), style: 'td', alignment: 'right' },
          ])
        : [
            [
              {
                text: 'Belum ada data dokter pada periode ini',
                style: 'td',
                colSpan: 2,
              },
              {},
            ],
          ]),
    ];

    const docDefinition: any = {
      pageMargins: [45, 50, 45, 50],
      pageOrientation: 'portrait',
      content: [
        {
          stack: [
            { text: clinic?.name || 'Klinik', style: 'clinicName' },
            {
              text: [clinic?.address, clinic?.city, clinic?.province]
                .filter(Boolean)
                .join(', '),
              style: 'clinicMeta',
            },
          ],
        },
        {
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 0,
              x2: 505,
              y2: 0,
              lineWidth: 1.5,
              lineColor: '#4F7EF8',
            },
          ],
          margin: [0, 8, 0, 10],
        },
        { text: 'Laporan Kinerja Keuangan & Bisnis', style: 'title' },
        {
          text: 'Disusun untuk Keperluan Pengajuan Pendanaan / Investor',
          style: 'subtitle',
        },
        {
          text: `Periode: ${monthLabel(data.periodStart)} – ${monthLabel(data.periodEnd)}  ·  Diterbitkan: ${generatedAtLabel}`,
          style: 'periodLine',
          margin: [0, 4, 0, 16],
        },

        { text: 'Ringkasan Eksekutif', style: 'sectionTitle' },
        { text: narrative, style: 'narrative', margin: [0, 4, 0, 12] },

        {
          columns: [
            this.summaryBox(
              'Total Pendapatan (12 Bulan)',
              formatRupiah(summary.totalRevenue12mo),
            ),
            this.summaryBox(
              summary.activeMonths12mo < 12
                ? `Rata-rata Pendapatan / Bulan (${summary.activeMonths12mo} bln aktif)`
                : 'Rata-rata Pendapatan / Bulan',
              formatRupiah(summary.avgMonthlyRevenue),
            ),
            this.summaryBox(
              'Pertumbuhan (3 Bulan Terakhir)',
              formatPercent(summary.recentGrowthPercent),
            ),
          ],
          columnGap: 12,
          margin: [0, 0, 0, 8],
        },
        {
          columns: [
            this.summaryBox(
              'Margin Bersih Rata-rata',
              `${summary.avgMarginPercent}%`,
            ),
            this.summaryBox(
              'Total Pasien Terlayani',
              String(summary.totalPatients12mo),
            ),
            this.summaryBox(
              'Laba Bersih (12 Bulan)',
              formatRupiah(summary.totalNetProfit12mo),
            ),
          ],
          columnGap: 12,
          margin: [0, 0, 0, 18],
        },

        {
          text: 'Tren Pendapatan & Laba 12 Bulan Terakhir',
          style: 'sectionTitle',
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', '*', '*', '*', 'auto', 'auto'],
            body: monthlyTableBody,
          },
          layout: this.tableLayout(),
          fontSize: 8.5,
          margin: [0, 0, 0, 18],
        },

        { text: 'Unit Economics', style: 'sectionTitle', margin: [0, 0, 0, 8] },
        {
          columns: [
            this.summaryBox(
              'Customer Lifetime Value (LTV)',
              formatRupiah(unitEconomics.ltv.averageLtv),
            ),
            this.summaryBox(
              'Avg. Revenue Per Visit (ARPV)',
              formatRupiah(unitEconomics.arpv),
            ),
            this.summaryBox(
              'Rata-rata Kunjungan / Pasien',
              `${unitEconomics.ltv.averageVisitsPerPatient}x`,
            ),
          ],
          columnGap: 12,
          margin: [0, 0, 0, 8],
        },
        {
          columns: [
            this.summaryBox('Retensi Pasien (Semester 1 ke 2)', retentionLabel),
            this.summaryBox(
              'Days Sales Outstanding (DSO)',
              `${unitEconomics.dso.averageDays} hari`,
            ),
            this.summaryBox(
              'Customer Acquisition Cost (CAC)',
              unitEconomics.marketing.cac !== null
                ? formatRupiah(unitEconomics.marketing.cac)
                : 'Belum ada data',
            ),
          ],
          columnGap: 12,
          margin: [0, 0, 0, 8],
        },
        unitEconomics.marketing.ltvCacRatio !== null
          ? {
              columns: [
                this.summaryBox(
                  'Rasio LTV : CAC',
                  `${unitEconomics.marketing.ltvCacRatio}x`,
                ),
                { text: '', width: '*' },
                { text: '', width: '*' },
              ],
              columnGap: 12,
              margin: [0, 0, 0, 18],
            }
          : { text: '', margin: [0, 0, 0, 18] },

        {
          text: 'Komposisi Pendapatan per Kategori Tindakan',
          style: 'sectionTitle',
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
            body: categoryTableBody,
          },
          layout: this.tableLayout(),
          fontSize: 9,
          margin: [0, 0, 0, 18],
        },

        {
          text: 'Kinerja per Dokter (12 Bulan)',
          style: 'sectionTitle',
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto'],
            body: doctorTableBody,
          },
          layout: this.tableLayout(),
          fontSize: 9,
          margin: [0, 0, 0, 18],
        },

        {
          text: `Laporan ini disusun otomatis oleh sistem ApexRecord berdasarkan data transaksi yang tercatat pada platform per ${generatedAtLabel}. Angka bersifat indikatif dan disarankan untuk diverifikasi bersama tim keuangan/akuntan sebelum digunakan dalam pengambilan keputusan investasi atau pendanaan.`,
          style: 'disclaimer',
        },
      ],
      styles: {
        clinicName: { fontSize: 15, bold: true, color: '#1A2340' },
        clinicMeta: { fontSize: 9, color: '#6B7A99', margin: [0, 2, 0, 0] },
        title: { fontSize: 18, bold: true, color: '#1A2340' },
        subtitle: {
          fontSize: 11,
          color: '#4F7EF8',
          bold: true,
          margin: [0, 2, 0, 0],
        },
        periodLine: { fontSize: 9.5, color: '#6B7A99' },
        sectionTitle: { fontSize: 12.5, bold: true, color: '#1A2340' },
        narrative: { fontSize: 10, color: '#1A2340', lineHeight: 1.35 },
        th: { fontSize: 9, bold: true, color: '#6B7A99', fillColor: '#F5F6FA' },
        td: { fontSize: 9, color: '#1A2340' },
        tdBold: { fontSize: 9, bold: true, color: '#1A2340' },
        summaryLabel: { fontSize: 8, color: '#6B7A99' },
        summaryValue: {
          fontSize: 13,
          bold: true,
          color: '#1A2340',
          margin: [0, 3, 0, 0],
        },
        disclaimer: {
          fontSize: 8,
          italics: true,
          color: '#A0AEC0',
          margin: [0, 10, 0, 0],
        },
      },
      defaultStyle: { font: 'Roboto' },
    };

    return PdfMake.createPdf(docDefinition).getBuffer();
  }

  private summaryBox(label: string, value: string) {
    return {
      width: '*',
      stack: [
        { text: label, style: 'summaryLabel' },
        { text: value, style: 'summaryValue' },
      ],
      margin: [10, 8, 10, 8],
      fillColor: '#F5F6FA',
    };
  }

  private tableLayout() {
    return {
      hLineWidth: (i: number, node: any) =>
        i === 0 || i === node.table.body.length ? 0 : 0.5,
      vLineWidth: () => 0,
      hLineColor: () => '#E8ECF4',
      paddingTop: () => 6,
      paddingBottom: () => 6,
    };
  }
}
