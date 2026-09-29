import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import { Billing, BillingStatus } from './entities/billing.entity';
// pdfmake ships no type declarations; `import PdfMake = require(...)` is the
// plain-CommonJS-safe way to pull in its default-exported singleton under
// `module: nodenext` without esModuleInterop guessing wrong.
import PdfMake = require('pdfmake');

// pdfmake 0.3.x's server build (js/index.js) exports one process-wide
// PdfMake instance whose fonts/access policies are configured via setters
// rather than passed to a constructor — so this must run exactly once.
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
// We only ever reference the bundled Roboto files above (no user-supplied
// paths/URLs reach pdfmake), so it's safe to allow local access and deny
// remote URLs outright.
PdfMake.setLocalAccessPolicy(() => true);
PdfMake.setUrlAccessPolicy(() => false);

const APEXRECORD_LOGO_PATH = path.join(
  __dirname,
  '..',
  '..',
  'assets',
  'logo-apex-record.png',
);

const STATUS_LABELS: Record<BillingStatus, string> = {
  [BillingStatus.UNPAID]: 'BELUM BAYAR',
  [BillingStatus.PARTIAL]: 'SEBAGIAN',
  [BillingStatus.PAID]: 'LUNAS',
  [BillingStatus.CANCELLED]: 'DIBATALKAN',
  [BillingStatus.REFUNDED]: 'REFUND',
};

const STATUS_COLORS: Record<BillingStatus, string> = {
  [BillingStatus.UNPAID]: '#FF4D4F',
  [BillingStatus.PARTIAL]: '#F5A623',
  [BillingStatus.PAID]: '#2DCB8A',
  [BillingStatus.CANCELLED]: '#6B7A99',
  [BillingStatus.REFUNDED]: '#6B7A99',
};

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Billing)
    private readonly billingRepository: Repository<Billing>,
  ) {}

  async generateInvoicePdf(
    billingId: number,
    clinicId: number,
  ): Promise<Buffer> {
    this.logger.log(
      `[CREATE] Generate invoice PDF | billingId=${billingId}, clinicId=${clinicId}`,
    );
    const billing = await this.billingRepository.findOne({
      where: { id: billingId, clinicId },
      relations: { patient: true, items: true, clinic: true },
    });
    if (!billing) {
      this.logger.warn(
        `[CREATE] Billing tidak ditemukan untuk generate PDF | billingId=${billingId}`,
      );
      throw new NotFoundException(
        `Billing dengan ID ${billingId} tidak ditemukan`,
      );
    }

    const rupiah = (value: number) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

    const itemRows = (billing.items || []).map((item) => [
      { text: item.name, style: 'tableCell' },
      { text: String(item.quantity), style: 'tableCell', alignment: 'center' },
      { text: rupiah(item.unitPrice), style: 'tableCell', alignment: 'right' },
      { text: rupiah(item.subtotal), style: 'tableCell', alignment: 'right' },
    ]);

    const clinic = billing.clinic;
    const clinicContactParts = [clinic?.phone, clinic?.email].filter(Boolean);
    const clinicLocationParts = [clinic?.city, clinic?.province].filter(Boolean);

    // Totals: only show a line when it's non-zero, so a simple fully-paid
    // cash invoice doesn't clutter the page with "Diskon: Rp 0" etc.
    const totalRows: any[] = [
      { label: 'Subtotal', value: billing.subtotal },
    ];
    if (Number(billing.totalDiscount) > 0) {
      totalRows.push({ label: 'Diskon', value: -billing.totalDiscount });
    }
    if (Number(billing.additionalFee) > 0) {
      totalRows.push({ label: 'Biaya Tambahan', value: billing.additionalFee });
    }

    const showPaymentBreakdown =
      Number(billing.paidAmount) > 0 && billing.status !== BillingStatus.PAID;

    const docDefinition: any = {
      pageMargins: [40, 40, 40, 60],
      content: [
        {
          columns: [
            { image: APEXRECORD_LOGO_PATH, width: 42, height: 42 },
            {
              width: '*',
              margin: [12, 0, 0, 0],
              stack: [
                { text: clinic?.name || 'Klinik', style: 'clinicName' },
                clinic?.address ? { text: clinic.address, style: 'clinicMeta' } : null,
                clinicLocationParts.length
                  ? { text: clinicLocationParts.join(', '), style: 'clinicMeta' }
                  : null,
                clinicContactParts.length
                  ? { text: clinicContactParts.join(' · '), style: 'clinicMeta' }
                  : null,
                clinic?.sipNumber ? { text: `SIP: ${clinic.sipNumber}`, style: 'clinicMeta' } : null,
              ].filter(Boolean),
            },
            {
              width: 'auto',
              alignment: 'right',
              stack: [
                { text: 'INVOICE', style: 'invoiceTitle' },
                { text: billing.invoiceNumber, style: 'invoiceNumber' },
                {
                  text: billing.createdAt?.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  }),
                  style: 'clinicMeta',
                },
              ],
            },
          ],
        },
        {
          canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1.5, lineColor: '#4F7EF8' }],
          margin: [0, 12, 0, 16],
        },
        {
          columns: [
            {
              text: [
                { text: 'Pasien\n', style: 'infoLabel' },
                { text: billing.patient?.name || '-', style: 'infoValue' },
              ],
            },
            {
              text: [
                { text: 'No. RM\n', style: 'infoLabel' },
                { text: billing.patient?.noRm || '-', style: 'infoValue' },
              ],
            },
            {
              alignment: 'right',
              text: [
                { text: 'Status\n', style: 'infoLabel' },
                {
                  text: STATUS_LABELS[billing.status],
                  bold: true,
                  color: STATUS_COLORS[billing.status],
                },
              ],
            },
          ],
          margin: [0, 0, 0, 16],
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto', 'auto'],
            body: [
              [
                { text: 'Layanan/Item', style: 'tableHeader' },
                { text: 'Qty', style: 'tableHeader', alignment: 'center' },
                { text: 'Harga Satuan', style: 'tableHeader', alignment: 'right' },
                { text: 'Subtotal', style: 'tableHeader', alignment: 'right' },
              ],
              ...itemRows,
            ],
          },
          layout: {
            hLineWidth: (i: number, node: any) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
            hLineColor: () => '#E8ECF4',
            vLineWidth: () => 0,
          },
          margin: [0, 0, 0, 12],
        },
        {
          columns: [
            { width: '*', text: '' },
            {
              width: 220,
              stack: [
                ...totalRows.map((row) => ({
                  columns: [
                    { text: row.label, style: 'totalLabel' },
                    { text: rupiah(row.value), style: 'totalValue', alignment: 'right' },
                  ],
                })),
                {
                  canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.5, lineColor: '#E8ECF4' }],
                  margin: [0, 4, 0, 4],
                },
                {
                  columns: [
                    { text: 'Total', style: 'grandTotalLabel' },
                    { text: rupiah(billing.grandTotal), style: 'grandTotalValue', alignment: 'right' },
                  ],
                },
                ...(showPaymentBreakdown
                  ? [
                      {
                        columns: [
                          { text: 'Sudah Dibayar', style: 'totalLabel' },
                          { text: rupiah(billing.paidAmount), style: 'totalValue', alignment: 'right' },
                        ],
                      },
                      {
                        columns: [
                          { text: 'Sisa Tagihan', style: 'totalLabel' },
                          {
                            text: rupiah(billing.outstandingAmount),
                            style: 'totalValue',
                            alignment: 'right',
                            bold: true,
                          },
                        ],
                      },
                    ]
                  : []),
              ],
            },
          ],
        },
      ],
      footer: {
        columns: [
          {
            text: 'Invoice ini dibuat otomatis oleh sistem ApexRecord.',
            style: 'footerNote',
            margin: [40, 0, 0, 0],
          },
        ],
        margin: [0, 20, 0, 0],
      },
      styles: {
        clinicName: { fontSize: 14, bold: true, color: '#1A2340' },
        clinicMeta: { fontSize: 9, color: '#6B7A99', margin: [0, 1, 0, 0] },
        invoiceTitle: { fontSize: 18, bold: true, color: '#4F7EF8' },
        invoiceNumber: { fontSize: 10, bold: true, color: '#1A2340', margin: [0, 2, 0, 2] },
        infoLabel: { fontSize: 9, color: '#A0AEC0' },
        infoValue: { fontSize: 11, bold: true, color: '#1A2340' },
        tableHeader: { bold: true, fillColor: '#F5F6FA', color: '#1A2340', margin: [4, 6, 4, 6] },
        tableCell: { margin: [4, 6, 4, 6], fontSize: 10 },
        totalLabel: { fontSize: 10, color: '#6B7A99' },
        totalValue: { fontSize: 10, color: '#1A2340' },
        grandTotalLabel: { fontSize: 12, bold: true, color: '#1A2340' },
        grandTotalValue: { fontSize: 12, bold: true, color: '#4F7EF8' },
        footerNote: { fontSize: 8, color: '#A0AEC0', italics: true },
      },
    };

    return PdfMake.createPdf(docDefinition).getBuffer();
  }
}
