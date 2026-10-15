import * as path from 'path';
// pdfmake ships no type declarations (see billing/invoice.service.ts).
import PdfMake = require('pdfmake');

const ROBOTO_DIR = path.join(
  require.resolve('pdfmake/package.json'),
  '..',
  'fonts',
  'Roboto',
);
// Same font setup as the invoice PDF; setFonts is idempotent.
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

const LOGO_PATH = path.join(
  __dirname,
  '..',
  '..',
  'assets',
  'logo-apex-record.png',
);

const COMPANY = {
  brand: 'ApexRecord',
  legalName: 'PT Zanak Developer Abadi',
  address: 'Jl. Jenderal Sudirman No. 7, Payakumbuh, Sumatera Barat',
  email: 'zanakdeveloper@gmail.com',
};

export interface ReceiptData {
  number: string;
  status: string;
  kind: 'new' | 'upgrade';
  confirmedAt: Date | null;
  planName: string | null;
  quantity: number;
  months: number;
  amount: number;
  promoDiscount: number;
  durationDiscount: number;
  extraStorageGb: number;
  storageAmount: number;
  billedTo: { name: string; email: string | null } | null;
  clinics: { id: number; name: string }[];
}

const rp = (n: number) => `Rp${Math.round(n).toLocaleString('id-ID')}`;

/** Kuitansi PDF pembayaran langganan yang sudah dikonfirmasi ("Lunas, dikonfirmasi"). */
export async function renderReceiptPdf(r: ReceiptData): Promise<Buffer> {
  const plan =
    r.kind === 'upgrade'
      ? `Naik paket ke ${r.planName ?? '-'} (selisih sisa masa aktif)`
      : `${r.planName ?? 'Langganan'}${r.quantity > 1 ? ` × ${r.quantity} klinik` : ''}${r.months > 1 ? ` × ${r.months} bulan` : ''}`;
  const planTotal =
    r.amount + r.promoDiscount + r.durationDiscount - r.storageAmount;
  const rows: [string, string][] = [[plan, rp(planTotal)]];
  if (r.promoDiscount > 0)
    rows.push(['Potongan promo', `− ${rp(r.promoDiscount)}`]);
  if (r.durationDiscount > 0)
    rows.push([
      `Diskon langganan ${r.months} bulan`,
      `− ${rp(r.durationDiscount)}`,
    ]);
  if (r.storageAmount > 0)
    rows.push([`Storage tambahan ${r.extraStorageGb} GB`, rp(r.storageAmount)]);
  const date = (r.confirmedAt ?? new Date()).toLocaleDateString('id-ID', {
    dateStyle: 'long',
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- pdfmake has no types
  const doc: any = {
    pageMargins: [40, 40, 40, 60],
    content: [
      {
        columns: [
          { image: LOGO_PATH, width: 40, height: 40 },
          {
            width: '*',
            margin: [12, 2, 0, 0],
            stack: [
              { text: COMPANY.brand, bold: true, fontSize: 14 },
              { text: COMPANY.legalName, fontSize: 9, color: '#6B7A99' },
              { text: COMPANY.address, fontSize: 9, color: '#6B7A99' },
            ],
          },
          {
            width: 'auto',
            alignment: 'right',
            stack: [
              { text: 'KUITANSI', bold: true, fontSize: 18 },
              { text: `No. ${r.number}`, fontSize: 10 },
              { text: date, fontSize: 10 },
              {
                text: r.status.toUpperCase(),
                bold: true,
                color: '#12875A',
                margin: [0, 6, 0, 0],
              },
            ],
          },
        ],
      },
      {
        canvas: [
          { type: 'line', x1: 0, y1: 8, x2: 515, y2: 8, lineWidth: 1.5 },
        ],
        margin: [0, 6, 0, 14],
      },
      {
        text: [
          'Telah diterima dari ',
          { text: r.billedTo?.name ?? '-', bold: true },
          r.billedTo?.email ? ` (${r.billedTo.email})` : '',
          ' untuk langganan ApexRecord:',
        ],
        margin: [0, 0, 0, 10],
      },
      {
        table: {
          widths: ['*', 'auto'],
          body: [
            ...rows.map(([a, b]) => [
              { text: a },
              { text: b, alignment: 'right' },
            ]),
            [
              { text: 'Total dibayar', bold: true, fontSize: 12 },
              {
                text: rp(r.amount),
                bold: true,
                fontSize: 12,
                alignment: 'right',
              },
            ],
          ],
        },
        layout: {
          hLineWidth: (i: number, node: { table: { body: unknown[] } }) =>
            i === node.table.body.length - 1
              ? 1.5
              : i === 0 || i === node.table.body.length
                ? 0
                : 0.5,
          vLineWidth: () => 0,
          hLineColor: () => '#C9D0DE',
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
      },
      r.clinics.length
        ? {
            text: `${r.kind === 'upgrade' ? 'Paket dinaikkan untuk' : 'Langganan diperpanjang untuk'}: ${r.clinics.map((c) => c.name).join(', ')}.`,
            margin: [0, 14, 0, 0],
          }
        : null,
      {
        text: `Harga sudah final; ${COMPANY.brand} belum berstatus PKP sehingga tidak memungut PPN. Kuitansi ini dibuat otomatis dan sah tanpa tanda tangan. Pertanyaan: ${COMPANY.email}.`,
        fontSize: 8.5,
        color: '#6B7A99',
        margin: [0, 24, 0, 0],
      },
    ].filter(Boolean),
    defaultStyle: { font: 'Roboto', fontSize: 10.5, color: '#1A2340' },
  };
  return PdfMake.createPdf(doc).getBuffer() as Promise<Buffer>;
}
