/** Angka romawi untuk numero resep (No. XV). Di luar 1–3999 ditulis angka biasa. */
export function toRoman(value: number): string {
  if (!Number.isInteger(value) || value < 1 || value > 3999)
    return String(value);
  const table: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let n = value;
  let out = '';
  for (const [v, s] of table) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

/** Baris obat resep: nama + dosis + sediaan, tanpa mengulang yang sudah ada di nama */
export function rxLine(
  name: string,
  dosage?: string | null,
  form?: string | null,
): string {
  const norm = (v: string) => v.toLowerCase().replace(/\s+/g, ' ');
  const lower = norm(name);
  const extra = [dosage, form]
    .map((p) => p?.trim())
    .filter((p): p is string => !!p && !lower.includes(norm(p)));
  return [name.trim(), ...extra].join(' ');
}
