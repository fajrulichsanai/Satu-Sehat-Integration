import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import ExcelJS from 'exceljs';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/patient.dto';
import {
  PATIENT_IMPORT_COLUMNS,
  PatientImportRawRow,
  lookupBloodType,
  lookupBoolean,
  lookupGender,
  lookupMaritalStatus,
  lookupRhesus,
} from './patient-import.columns';

export interface PatientImportRowResult {
  row: number;
  name?: string;
  noRm?: string;
  status: 'created' | 'failed';
  message?: string;
}

export interface PatientImportSummary {
  totalRows: number;
  created: number;
  failed: number;
  results: PatientImportRowResult[];
}

@Injectable()
export class PatientImportService {
  private readonly logger = new Logger(PatientImportService.name);

  constructor(private readonly patientsService: PatientsService) {}

  /** Builds the downloadable .xlsx template: header + one example row, plus a
   * "Petunjuk" sheet spelling out which columns are required and accepted values. */
  async generateTemplateBuffer(): Promise<Buffer> {
    const headers = PATIENT_IMPORT_COLUMNS.map((c) => c.header);
    const exampleRow = PATIENT_IMPORT_COLUMNS.map((c) => c.example);

    const workbook = new ExcelJS.Workbook();

    const dataSheet = workbook.addWorksheet('Data Pasien');
    dataSheet.addRow(headers);
    dataSheet.addRow(exampleRow);
    dataSheet.columns.forEach((col) => (col.width = 20));

    const instructionsSheet = workbook.addWorksheet('Petunjuk');
    instructionsSheet.addRow(['Kolom', 'Wajib?', 'Keterangan']);
    for (const c of PATIENT_IMPORT_COLUMNS) {
      instructionsSheet.addRow([
        c.header,
        c.required ? 'Wajib' : 'Opsional',
        c.note || '-',
      ]);
    }
    [22, 10, 55].forEach((w, i) => (instructionsSheet.getColumn(i + 1).width = w));

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /** Reads the first sheet of an uploaded workbook (.xlsx or .csv) into raw
   * string rows, matching columns by header text (case/whitespace-insensitive)
   * rather than position — so a clinic reordering or omitting optional columns
   * still parses correctly. */
  async parseFile(buffer: Buffer): Promise<PatientImportRawRow[]> {
    if (isLegacyXls(buffer)) {
      throw new BadRequestException(
        'Format .xls lama tidak didukung — simpan ulang file sebagai .xlsx atau .csv',
      );
    }
    const grid = isZip(buffer)
      ? await readXlsxGrid(buffer)
      : readCsvGrid(buffer);

    const [headerRow, ...dataRows] = grid;
    if (!headerRow) return [];

    const headerToField = new Map(
      PATIENT_IMPORT_COLUMNS.map((c) => [c.header.trim().toLowerCase(), c.field]),
    );
    const columnFields = headerRow.map((h) =>
      headerToField.get(h.trim().toLowerCase()),
    );

    return dataRows
      .filter((cells) => cells.some((v) => v.trim() !== ''))
      .map((cells) => {
        const mapped: PatientImportRawRow = {};
        columnFields.forEach((field, i) => {
          if (!field) return;
          mapped[field] = (cells[i] ?? '').trim();
        });
        return mapped;
      });
  }

  private isRowBlank(row: PatientImportRawRow): boolean {
    return Object.values(row).every((v) => !v || String(v).trim() === '');
  }

  /** Imports every non-blank row, creating patients one at a time via the same
   * PatientsService.create() used by the normal registration form — so NIK
   * dedup, RM-number generation, and field validation all stay in one place.
   * A bad row never aborts the batch: it's recorded with a precise reason and
   * every other row is still attempted, so nothing is silently dropped. */
  async importRows(
    clinicId: number,
    rows: PatientImportRawRow[],
  ): Promise<PatientImportSummary> {
    const results: PatientImportRowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // header occupies row 1
      if (this.isRowBlank(row)) continue;

      const labelErrors: string[] = [];

      const genderLookup = lookupGender(row.gender);
      if (genderLookup.invalid) {
        labelErrors.push(
          `Jenis Kelamin tidak valid: "${genderLookup.invalid}" (gunakan Laki-laki/Perempuan)`,
        );
      }

      const maritalLookup = lookupMaritalStatus(row.maritalStatus);
      if (maritalLookup.invalid) {
        labelErrors.push(
          `Status Pernikahan tidak valid: "${maritalLookup.invalid}"`,
        );
      }

      const bloodLookup = lookupBloodType(row.golonganDarah);
      if (bloodLookup.invalid) {
        labelErrors.push(
          `Golongan Darah tidak valid: "${bloodLookup.invalid}" (gunakan A/B/AB/O)`,
        );
      }

      const rhesusLookup = lookupRhesus(row.rhesus);
      if (rhesusLookup.invalid) {
        labelErrors.push(
          `Rhesus tidak valid: "${rhesusLookup.invalid}" (gunakan Positif/Negatif)`,
        );
      }

      const punyaAlergiLookup = lookupBoolean(row.punyaAlergi);
      if (punyaAlergiLookup.invalid) {
        labelErrors.push(
          `Punya Alergi tidak valid: "${punyaAlergiLookup.invalid}" (gunakan Ya/Tidak)`,
        );
      }

      const hipertensiLookup = lookupBoolean(row.riwayatHipertensi);
      if (hipertensiLookup.invalid) {
        labelErrors.push(
          `Riwayat Hipertensi tidak valid: "${hipertensiLookup.invalid}" (gunakan Ya/Tidak)`,
        );
      }

      const diabetesLookup = lookupBoolean(row.riwayatDiabetes);
      if (diabetesLookup.invalid) {
        labelErrors.push(
          `Riwayat Diabetes tidak valid: "${diabetesLookup.invalid}" (gunakan Ya/Tidak)`,
        );
      }

      const paruLookup = lookupBoolean(row.riwayatParuParu);
      if (paruLookup.invalid) {
        labelErrors.push(
          `Riwayat Paru-paru tidak valid: "${paruLookup.invalid}" (gunakan Ya/Tidak)`,
        );
      }

      if (labelErrors.length > 0) {
        results.push({
          row: rowNumber,
          name: row.name,
          noRm: row.noRm,
          status: 'failed',
          message: labelErrors.join('; '),
        });
        continue;
      }

      const dto = plainToInstance(CreatePatientDto, {
        name: row.name,
        gender: genderLookup.value,
        dateOfBirth: row.dateOfBirth || undefined,
        nik: row.nik || undefined,
        phone: row.phone || undefined,
        email: row.email || undefined,
        address: row.address || undefined,
        kelurahan: row.kelurahan || undefined,
        kecamatan: row.kecamatan || undefined,
        city: row.city || undefined,
        province: row.province || undefined,
        postalCode: row.postalCode || undefined,
        pekerjaan: row.pekerjaan || undefined,
        maritalStatus: maritalLookup.value,
        golonganDarah: bloodLookup.value,
        rhesus: rhesusLookup.value,
        punyaAlergi: punyaAlergiLookup.value ?? false,
        catatanAlergi: row.catatanAlergi || undefined,
        riwayatHipertensi: hipertensiLookup.value ?? false,
        riwayatDiabetes: diabetesLookup.value ?? false,
        riwayatParuParu: paruLookup.value ?? false,
      });

      const validationErrors = await validate(dto, { whitelist: true });
      if (validationErrors.length > 0) {
        const message = validationErrors
          .map((e) => Object.values(e.constraints || {}).join(', '))
          .filter(Boolean)
          .join('; ');
        results.push({
          row: rowNumber,
          name: row.name,
          noRm: row.noRm,
          status: 'failed',
          message: message || 'Data tidak valid',
        });
        continue;
      }

      try {
        const created = await this.patientsService.create(
          clinicId,
          dto,
          row.noRm || undefined,
        );
        results.push({
          row: rowNumber,
          name: created.name,
          noRm: created.noRm,
          status: 'created',
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Gagal menyimpan data pasien';
        this.logger.warn(
          `[IMPORT] Baris ${rowNumber} gagal | clinicId=${clinicId}, reason=${message}`,
        );
        results.push({
          row: rowNumber,
          name: row.name,
          noRm: row.noRm,
          status: 'failed',
          message,
        });
      }
    }

    const created = results.filter((r) => r.status === 'created').length;
    this.logger.log(
      `[IMPORT] Selesai | clinicId=${clinicId}, total=${results.length}, berhasil=${created}, gagal=${results.length - created}`,
    );

    return {
      totalRows: results.length,
      created,
      failed: results.length - created,
      results,
    };
  }
}

function isZip(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b; // "PK"
}

function isLegacyXls(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  );
}

function formatCell(value: ExcelJS.CellValue, text: string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return String(value);
  return text ?? '';
}

async function readXlsxGrid(buffer: Buffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's Buffer type predates Node's generic Buffer<ArrayBufferLike>.
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const grid: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber - 1] = formatCell(cell.value, cell.text);
    });
    grid[rowNumber - 1] = Array.from(cells, (v) => v ?? '');
  });
  return Array.from(grid, (r) => r ?? []);
}

/** Minimal RFC 4180 CSV reader. Keeps every value as text (so phone numbers
 * keep their leading 0) and auto-detects ";" — the default list separator
 * for Excel on Indonesian-locale Windows — versus ",". */
function readCsvGrid(buffer: Buffer): string[][] {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0)
      ? ';'
      : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
