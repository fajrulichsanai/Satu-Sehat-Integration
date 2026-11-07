import { toCsv } from '../csv';

describe('toCsv', () => {
  it('writes a BOM, header and quoted cells (positive)', () => {
    const csv = toCsv(['Nama', 'Catatan'], [['Klinik A', 'satu, "dua"']]);
    expect(csv.startsWith('﻿Nama,Catatan\r\n')).toBe(true);
    expect(csv).toContain('Klinik A,"satu, ""dua"""');
  });

  it('neutralises spreadsheet formulas (negative)', () => {
    expect(toCsv(['x'], [['=HYPERLINK("http://evil")']])).toContain(
      `"'=HYPERLINK(""http://evil"")"`,
    );
  });

  it('leaves empty cells for null and undefined (edge)', () => {
    expect(toCsv(['a', 'b'], [[null, undefined]])).toContain('\r\n,\r\n');
  });
});
