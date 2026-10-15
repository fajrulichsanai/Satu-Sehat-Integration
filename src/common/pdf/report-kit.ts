import * as path from 'path';
// pdfmake's server build is a process-wide singleton; setting the same
// fonts again here (as invoice/prescription services do) is harmless.
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

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Node = any;

export const INK = '#1A2340';
export const MUTED = '#6B7A99';
export const LINE = '#E3E7EF';
export const SOFT = '#F5F6FA';
export const ACCENT = '#2F6B2A';
export const NEG = '#C0392B';

export function rp(value: number | string | null | undefined): string {
  const n = Math.round(Number(value || 0));
  const s = `Rp ${Math.abs(n).toLocaleString('id-ID')}`;
  return n < 0 ? `(${s})` : s;
}

export function tanggalPanjang(d: Date | string): string {
  const date =
    typeof d === 'string' ? new Date(d.length === 10 ? `${d}T00:00:00` : d) : d;
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

const BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
export function tanggalPendek(d: string): string {
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${day}/${m}/${y}`;
}

export function periodeLabel(period: string): string {
  const [y, m] = period.split('-');
  return `${BULAN[Number(m) - 1]} ${y}`;
}

export interface ClinicHeader {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  phone?: string | null;
}

/** Kop dokumen: nama klinik kiri, judul dokumen kanan, garis bawah. */
export function header(
  clinic: ClinicHeader | null,
  title: string,
  subtitle?: string,
  landscape = false,
): Node[] {
  const meta = [clinic?.address, clinic?.city, clinic?.province]
    .filter(Boolean)
    .join(', ');
  return [
    {
      columns: [
        {
          width: '*',
          stack: [
            {
              text: (clinic?.name || 'Klinik').toUpperCase(),
              fontSize: 14,
              bold: true,
              color: INK,
            },
            meta
              ? {
                  text: meta,
                  fontSize: 8.5,
                  color: MUTED,
                  margin: [0, 2, 0, 0],
                }
              : '',
            clinic?.phone
              ? { text: `Telp. ${clinic.phone}`, fontSize: 8.5, color: MUTED }
              : '',
          ],
        },
        {
          width: 'auto',
          stack: [
            {
              text: title,
              fontSize: 15,
              bold: true,
              color: INK,
              alignment: 'right',
            },
            subtitle
              ? {
                  text: subtitle,
                  fontSize: 9.5,
                  color: MUTED,
                  alignment: 'right',
                  margin: [0, 2, 0, 0],
                }
              : '',
          ],
        },
      ],
    },
    {
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: landscape ? 762 : 515,
          y2: 0,
          lineWidth: 1.2,
          lineColor: INK,
        },
      ],
      margin: [0, 10, 0, 14],
    },
  ];
}

export function section(text: string, note?: string): Node {
  return {
    stack: [
      { text, fontSize: 11.5, bold: true, color: INK },
      note
        ? { text: note, fontSize: 8.5, color: MUTED, margin: [0, 1, 0, 0] }
        : '',
    ],
    margin: [0, 12, 0, 6],
    unbreakable: true,
    headlineLevel: 1,
  };
}

export interface Col {
  text: string;
  width?: string | number;
  right?: boolean;
}

/**
 * Tabel standar: header berulang di halaman baru, baris tidak terpotong,
 * angka rata kanan, baris total (opsional) tebal dengan latar.
 */
export function table(
  cols: Col[],
  rows: (string | number | Node)[][],
  opts: { total?: (string | number | Node)[]; empty?: string } = {},
): Node {
  const cell = (
    v: string | number | Node,
    i: number,
    extra: Record<string, unknown> = {},
  ) =>
    typeof v === 'object' && v !== null
      ? {
          fontSize: 8.5,
          color: INK,
          alignment: cols[i]?.right ? 'right' : 'left',
          ...v,
          ...extra,
        }
      : {
          text: String(v),
          fontSize: 8.5,
          color: INK,
          alignment: cols[i]?.right ? 'right' : 'left',
          ...extra,
        };
  const body: Node[] = [
    cols.map((c) => ({
      text: c.text,
      fontSize: 8,
      bold: true,
      color: MUTED,
      fillColor: SOFT,
      alignment: c.right ? 'right' : 'left',
    })),
  ];
  if (!rows.length) {
    body.push([
      {
        text: opts.empty ?? 'Tidak ada data',
        colSpan: cols.length,
        fontSize: 8.5,
        color: MUTED,
        italics: true,
      },
      ...cols.slice(1).map(() => ({})),
    ]);
  } else {
    for (const r of rows) body.push(r.map((v, i) => cell(v, i)));
  }
  if (opts.total)
    body.push(
      opts.total.map((v, i) => cell(v, i, { bold: true, fillColor: SOFT })),
    );
  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: cols.map((c) => c.width ?? (c.right ? 'auto' : '*')),
      body,
    },
    layout: {
      hLineWidth: (i: number, node: Node) =>
        i === 0 || i === node.table.body.length ? 0 : 0.5,
      vLineWidth: () => 0,
      hLineColor: () => LINE,
      paddingTop: () => 5,
      paddingBottom: () => 5,
      paddingLeft: () => 6,
      paddingRight: () => 6,
    },
    margin: [0, 0, 0, 6],
  };
}

/** Baris kotak ringkasan angka (KPI). */
export function kpis(
  items: { label: string; value: string; tone?: 'neg' | 'ok' }[],
): Node {
  return {
    columns: items.map((k) => ({
      width: '*',
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                { text: k.label, fontSize: 7.5, color: MUTED },
                {
                  text: k.value,
                  fontSize: 12,
                  bold: true,
                  color:
                    k.tone === 'neg' ? NEG : k.tone === 'ok' ? ACCENT : INK,
                  margin: [0, 3, 0, 0],
                },
              ],
              fillColor: SOFT,
              margin: [4, 4, 4, 4],
            },
          ],
        ],
      },
      layout: 'noBorders',
    })),
    columnGap: 8,
    margin: [0, 0, 0, 4],
  };
}

/** Footer: halaman x/y + jejak pembuat. */
export function footer(generatedBy: string) {
  return (current: number, total: number): Node => ({
    columns: [
      { text: generatedBy, fontSize: 7.5, color: MUTED },
      {
        text: `Halaman ${current} / ${total}`,
        fontSize: 7.5,
        color: MUTED,
        alignment: 'right',
      },
    ],
    margin: [40, 10, 40, 0],
  });
}

export function render(
  content: Node[],
  generatedBy: string,
  landscape = false,
): Promise<Buffer> {
  return PdfMake.createPdf({
    pageSize: 'A4',
    pageOrientation: landscape ? 'landscape' : 'portrait',
    pageMargins: [40, 36, 40, 44],
    content,
    footer: footer(generatedBy),
    // Judul bagian tidak boleh tertinggal sendirian di dasar halaman
    pageBreakBefore: (node: Node, after: Node[]) =>
      node.headlineLevel === 1 && after.length < 6,
    defaultStyle: { font: 'Roboto', fontSize: 9, color: INK },
  }).getBuffer();
}
