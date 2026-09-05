import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as path from 'path';
import { Billing } from './entities/billing.entity';
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
      relations: { patient: true, items: true },
    });
    if (!billing) {
      this.logger.warn(
        `[CREATE] Billing tidak ditemukan untuk generate PDF | billingId=${billingId}`,
      );
      throw new NotFoundException(
        `Billing dengan ID ${billingId} tidak ditemukan`,
      );
    }

    const itemRows = (billing.items || []).map((item) => [
      { text: item.name, style: 'tableCell' },
      { text: String(item.quantity), style: 'tableCell', alignment: 'center' },
      {
        text: `Rp ${Number(item.unitPrice).toLocaleString('id-ID')}`,
        style: 'tableCell',
        alignment: 'right',
      },
      {
        text: `Rp ${Number(item.subtotal).toLocaleString('id-ID')}`,
        style: 'tableCell',
        alignment: 'right',
      },
    ]);

    const docDefinition: any = {
      content: [
        { text: 'INVOICE', style: 'header' },
        { text: `No. Invoice: ${billing.invoiceNumber}`, style: 'subheader' },
        {
          text: `Tanggal: ${billing.createdAt?.toLocaleDateString('id-ID')}`,
          margin: [0, 0, 0, 10],
        },
        {
          text: `Pasien: ${billing.patient?.name || '-'}`,
          margin: [0, 0, 0, 4],
        },
        {
          text: `No. RM: ${billing.patient?.noRm || '-'}`,
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
                {
                  text: 'Harga Satuan',
                  style: 'tableHeader',
                  alignment: 'right',
                },
                { text: 'Subtotal', style: 'tableHeader', alignment: 'right' },
              ],
              ...itemRows,
            ],
          },
          margin: [0, 0, 0, 10],
        },
        {
          canvas: [
            { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5 },
          ],
          margin: [0, 0, 0, 4],
        },
        {
          columns: [
            { text: '' },
            {
              text: `Subtotal: Rp ${Number(billing.subtotal).toLocaleString('id-ID')}`,
              alignment: 'right',
            },
          ],
        },
        {
          columns: [
            { text: '' },
            {
              text: `Diskon: Rp ${Number(billing.totalDiscount).toLocaleString('id-ID')}`,
              alignment: 'right',
            },
          ],
        },
        {
          columns: [
            { text: '' },
            {
              text: `Total: Rp ${Number(billing.grandTotal).toLocaleString('id-ID')}`,
              style: 'total',
              alignment: 'right',
            },
          ],
        },
        {
          columns: [
            { text: '' },
            {
              text: `Status: ${billing.status.toUpperCase()}`,
              alignment: 'right',
              margin: [0, 4, 0, 0],
            },
          ],
        },
      ],
      styles: {
        header: {
          fontSize: 20,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 8],
        },
        subheader: { fontSize: 13, bold: true, margin: [0, 0, 0, 4] },
        tableHeader: { bold: true, fillColor: '#eeeeee', margin: [4, 4, 4, 4] },
        tableCell: { margin: [4, 4, 4, 4] },
        total: { bold: true, fontSize: 13 },
      },
    };

    return PdfMake.createPdf(docDefinition).getBuffer();
  }
}
