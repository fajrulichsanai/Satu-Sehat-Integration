import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Billing } from './entities/billing.entity';
import * as PdfPrinter from 'pdfmake';

@Injectable()
export class InvoiceService {
  constructor(
    @InjectRepository(Billing)
    private readonly billingRepository: Repository<Billing>,
  ) {}

  async generateInvoicePdf(billingId: number, clinicId: number): Promise<Buffer> {
    const billing = await this.billingRepository.findOne({
      where: { id: billingId, clinicId },
      relations: { patient: true, items: true },
    });
    if (!billing) throw new NotFoundException(`Billing dengan ID ${billingId} tidak ditemukan`);

    const fonts = {
      Roboto: {
        normal: Buffer.from(''),
        bold: Buffer.from(''),
        italics: Buffer.from(''),
        bolditalics: Buffer.from(''),
      },
    };

    const printer = new PdfPrinter(fonts);

    const itemRows = (billing.items || []).map((item) => [
      { text: item.name, style: 'tableCell' },
      { text: String(item.quantity), style: 'tableCell', alignment: 'center' },
      { text: `Rp ${Number(item.unitPrice).toLocaleString('id-ID')}`, style: 'tableCell', alignment: 'right' },
      { text: `Rp ${Number(item.subtotal).toLocaleString('id-ID')}`, style: 'tableCell', alignment: 'right' },
    ]);

    const docDefinition: any = {
      content: [
        { text: 'INVOICE', style: 'header' },
        { text: `No. Invoice: ${billing.invoiceNumber}`, style: 'subheader' },
        { text: `Tanggal: ${billing.createdAt?.toLocaleDateString('id-ID')}`, margin: [0, 0, 0, 10] },
        { text: `Pasien: ${billing.patient?.name || '-'}`, margin: [0, 0, 0, 4] },
        { text: `No. RM: ${billing.patient?.noRm || '-'}`, margin: [0, 0, 0, 16] },
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
          margin: [0, 0, 0, 10],
        },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5 }], margin: [0, 0, 0, 4] },
        { columns: [{ text: '' }, { text: `Subtotal: Rp ${Number(billing.subtotal).toLocaleString('id-ID')}`, alignment: 'right' }] },
        { columns: [{ text: '' }, { text: `Diskon: Rp ${Number(billing.totalDiscount).toLocaleString('id-ID')}`, alignment: 'right' }] },
        { columns: [{ text: '' }, { text: `Total: Rp ${Number(billing.grandTotal).toLocaleString('id-ID')}`, style: 'total', alignment: 'right' }] },
        { columns: [{ text: '' }, { text: `Status: ${billing.status.toUpperCase()}`, alignment: 'right', margin: [0, 4, 0, 0] }] },
      ],
      styles: {
        header: { fontSize: 20, bold: true, alignment: 'center', margin: [0, 0, 0, 8] },
        subheader: { fontSize: 13, bold: true, margin: [0, 0, 0, 4] },
        tableHeader: { bold: true, fillColor: '#eeeeee', margin: [4, 4, 4, 4] },
        tableCell: { margin: [4, 4, 4, 4] },
        total: { bold: true, fontSize: 13 },
      },
    };

    return new Promise((resolve, reject) => {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });
  }
}
