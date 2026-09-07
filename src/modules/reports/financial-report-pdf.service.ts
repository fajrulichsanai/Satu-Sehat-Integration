import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { ReportsService } from './reports.service';
import { FinancialReportQueryDto } from './dto/report.dto';
// pdfmake's server build exports one process-wide singleton configured via
// setters — already initialized by prescription-pdf.service.ts on import;
// calling the same setters again here is harmless (same values).
import PdfMake = require('pdfmake');

function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

function formatTanggal(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

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

@Injectable()
export class FinancialReportPdfService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicRepository: Repository<Clinic>,
    private readonly reportsService: ReportsService,
  ) {}

  /** Laporan siap print/kirim ke akuntan — ringkasan periode yang sedang difilter di halaman Pro. */
  async generate(
    clinicId: number,
    query: FinancialReportQueryDto,
  ): Promise<Buffer> {
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });
    const { data } = await this.reportsService.getFinancialReportPro(
      clinicId,
      query,
    );

    const generatedAtLabel = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const tindakanTableBody: any[] = [
      [
        { text: 'Tindakan', style: 'th' },
        { text: 'Frekuensi', style: 'th', alignment: 'right' },
        { text: 'Modal', style: 'th', alignment: 'right' },
        { text: 'Diskon', style: 'th', alignment: 'right' },
        { text: 'Laba Bersih', style: 'th', alignment: 'right' },
      ],
      ...(data.tindakanTerlaris.length
        ? data.tindakanTerlaris.map((t) => [
            { text: t.namaTindakan, style: 'td' },
            { text: String(t.frekuensi), style: 'td', alignment: 'right' },
            { text: formatRupiah(t.modal), style: 'td', alignment: 'right' },
            {
              text: formatRupiah(t.totalDiskon),
              style: 'td',
              alignment: 'right',
            },
            {
              text: formatRupiah(t.labaBersih),
              style: 'td',
              alignment: 'right',
            },
          ])
        : [
            [
              { text: 'Belum ada data tindakan', style: 'td', colSpan: 5 },
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
        { text: 'Pendapatan', style: 'th', alignment: 'right' },
        { text: 'Fee Dokter', style: 'th', alignment: 'right' },
        { text: 'Laba Bersih', style: 'th', alignment: 'right' },
      ],
      ...(data.byDoctorProfit.length
        ? data.byDoctorProfit.map((d) => [
            { text: d.practitionerName, style: 'td' },
            { text: formatRupiah(d.revenue), style: 'td', alignment: 'right' },
            {
              text: formatRupiah(d.doctorFeeShare),
              style: 'td',
              alignment: 'right',
            },
            {
              text: formatRupiah(d.labaBersih),
              style: 'td',
              alignment: 'right',
            },
          ])
        : [
            [
              { text: 'Belum ada data dokter', style: 'td', colSpan: 4 },
              {},
              {},
              {},
            ],
          ]),
    ];

    const monthlyTableBody: any[] = [
      [
        { text: 'Bulan', style: 'th' },
        { text: 'Pendapatan', style: 'th', alignment: 'right' },
        { text: 'Pengeluaran', style: 'th', alignment: 'right' },
        { text: 'Laba Bersih', style: 'th', alignment: 'right' },
      ],
      ...data.monthlyTrend.map((m) => [
        { text: monthLabel(m.month), style: 'td' },
        { text: formatRupiah(m.revenue), style: 'td', alignment: 'right' },
        { text: formatRupiah(m.expense), style: 'td', alignment: 'right' },
        { text: formatRupiah(m.netProfit), style: 'td', alignment: 'right' },
      ]),
    ];

    const stockTableBody: any[] = [
      [
        { text: 'Bahan', style: 'th' },
        { text: 'Qty Terpakai', style: 'th', alignment: 'right' },
        { text: 'Biaya', style: 'th', alignment: 'right' },
      ],
      ...(data.stockReport.usage.length
        ? data.stockReport.usage.slice(0, 10).map((u) => [
            { text: u.barangName, style: 'td' },
            {
              text: `${u.qtyUsed} ${u.satuan}`,
              style: 'td',
              alignment: 'right',
            },
            {
              text: formatRupiah(u.totalCost),
              style: 'td',
              alignment: 'right',
            },
          ])
        : [
            [
              {
                text: 'Belum ada pemakaian bahan pada periode ini',
                style: 'td',
                colSpan: 3,
              },
              {},
              {},
            ],
          ]),
    ];

    const docDefinition: any = {
      pageMargins: [45, 50, 45, 50],
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
        { text: 'Laporan Keuangan', style: 'title' },
        {
          text: 'Disusun untuk Keperluan Internal / Akuntan',
          style: 'subtitle',
        },
        {
          text: `Periode: ${formatTanggal(query.dateFrom)} – ${formatTanggal(query.dateTo)}  ·  Diterbitkan: ${generatedAtLabel}`,
          style: 'periodLine',
          margin: [0, 4, 0, 16],
        },

        {
          columns: [
            this.summaryBox(
              'Total Pendapatan',
              formatRupiah(data.summary.totalPaid),
            ),
            this.summaryBox(
              'Total Pengeluaran',
              formatRupiah(data.ringkasan.pengeluaran),
            ),
            this.summaryBox('Laba Kotor', formatRupiah(data.labaKotor)),
          ],
          columnGap: 12,
          margin: [0, 0, 0, 8],
        },
        {
          columns: [
            this.summaryBox(
              'Laba Bersih',
              formatRupiah(data.ringkasan.labaBersih),
            ),
            this.summaryBox(
              'Margin Keuntungan',
              `${data.ringkasan.marginPersen}%`,
            ),
            this.summaryBox(
              'Total Piutang',
              formatRupiah(data.summary.totalOutstanding),
            ),
          ],
          columnGap: 12,
          margin: [0, 0, 0, 18],
        },

        {
          text: 'Tren 6 Bulan Terakhir',
          style: 'sectionTitle',
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', '*', '*'],
            body: monthlyTableBody,
          },
          layout: this.tableLayout(),
          fontSize: 9,
          margin: [0, 0, 0, 18],
        },

        { text: 'Tindakan', style: 'sectionTitle', margin: [0, 0, 0, 8] },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto', 'auto'],
            body: tindakanTableBody,
          },
          layout: this.tableLayout(),
          fontSize: 8.5,
          margin: [0, 0, 0, 18],
        },

        {
          text: 'Kinerja per Dokter',
          style: 'sectionTitle',
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto'],
            body: doctorTableBody,
          },
          layout: this.tableLayout(),
          fontSize: 9,
          margin: [0, 0, 0, 18],
        },

        { text: 'Laporan Stok', style: 'sectionTitle', margin: [0, 0, 0, 8] },
        {
          text: `Total nilai inventory saat ini: ${formatRupiah(data.stockReport.totalInventoryValue)} (${data.stockReport.totalActiveItems} item aktif)`,
          style: 'narrative',
          margin: [0, 0, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto'],
            body: stockTableBody,
          },
          layout: this.tableLayout(),
          fontSize: 9,
          margin: [0, 0, 0, 18],
        },

        {
          text: `Laporan ini disusun otomatis oleh sistem ApexRecord berdasarkan data transaksi yang tercatat pada platform per ${generatedAtLabel}. Disarankan untuk diverifikasi bersama tim keuangan/akuntan sebelum digunakan untuk pelaporan resmi.`,
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
