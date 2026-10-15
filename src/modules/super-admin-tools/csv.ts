/** CSV untuk Excel/Sheets: pemisah koma, kutip ganda, BOM UTF-8 agar huruf terbaca. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    const s =
      v instanceof Date
        ? v.toISOString()
        : typeof v === 'object'
          ? JSON.stringify(v)
          : String(v as string | number | boolean);
    // Cegah formula injection saat dibuka di spreadsheet.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const lines = [headers, ...rows].map((r) => r.map(cell).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}
