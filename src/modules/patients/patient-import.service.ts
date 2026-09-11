import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as XLSX from 'xlsx';
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
  generateTemplateBuffer(): Buffer {
    const headers = PATIENT_IMPORT_COLUMNS.map((c) => c.header);
    const exampleRow = PATIENT_IMPORT_COLUMNS.map((c) => c.example);

    const dataSheet = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
    dataSheet['!cols'] = headers.map(() => ({ wch: 20 }));

    const instructionsSheet = XLSX.utils.aoa_to_sheet([
      ['Kolom', 'Wajib?', 'Keterangan'],
      ...PATIENT_IMPORT_COLUMNS.map((c) => [
        c.header,
        c.required ? 'Wajib' : 'Opsional',
        c.note || '-',
      ]),
    ]);
    instructionsSheet['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 55 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, dataSheet, 'Data Pasien');
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Petunjuk');

    return XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;
  }

  /** Reads the first sheet of an uploaded workbook into raw string rows, matching
   * columns by header text (case/whitespace-insensitive) rather than position —
   * so a clinic reordering or omitting optional columns still parses correctly. */
  parseFile(buffer: Buffer): PatientImportRawRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const sheet = workbook.Sheets[firstSheetName];

    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
      dateNF: 'yyyy-mm-dd',
    });

    const headerToField = new Map(
      PATIENT_IMPORT_COLUMNS.map((c) => [c.header.trim().toLowerCase(), c.field]),
    );

    return raw.map((rawRow) => {
      const mapped: PatientImportRawRow = {};
      for (const [key, value] of Object.entries(rawRow)) {
        const field = headerToField.get(key.trim().toLowerCase());
        if (!field) continue;
        mapped[field] =
          value === undefined || value === null ? '' : String(value).trim();
      }
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
