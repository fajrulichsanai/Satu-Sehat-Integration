import { Test, TestingModule } from '@nestjs/testing';
import * as XLSX from 'xlsx';
import { ConflictException } from '@nestjs/common';
import { PatientImportService } from '../patient-import.service';
import { PatientsService } from '../patients.service';
import { PATIENT_IMPORT_COLUMNS, PatientImportRawRow } from '../patient-import.columns';
import { Gender } from '../../../enums';

function buildWorkbookBuffer(rows: Record<string, string>[]): Buffer {
  const headers = PATIENT_IMPORT_COLUMNS.map((c) => c.header);
  const aoa = [headers, ...rows.map((row) => headers.map((h) => row[h] ?? ''))];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data Pasien');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('PatientImportService', () => {
  let service: PatientImportService;
  let patientsService: { create: jest.Mock };

  beforeEach(async () => {
    patientsService = { create: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientImportService,
        { provide: PatientsService, useValue: patientsService },
      ],
    }).compile();

    service = module.get<PatientImportService>(PatientImportService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('generateTemplateBuffer', () => {
    it('produces a workbook with a Data Pasien sheet whose headers match the column spec, plus a Petunjuk sheet (positive)', () => {
      const buffer = service.generateTemplateBuffer();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      expect(workbook.SheetNames).toEqual(['Data Pasien', 'Petunjuk']);

      const dataSheet = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets['Data Pasien'], { header: 1 });
      expect(dataSheet[0]).toEqual(PATIENT_IMPORT_COLUMNS.map((c) => c.header));
      // Example row given so the client sees a filled-in sample, not just headers.
      expect(dataSheet[1]).toHaveLength(PATIENT_IMPORT_COLUMNS.length);
    });
  });

  describe('parseFile', () => {
    it('maps columns by header text regardless of column order (positive)', () => {
      const headers = PATIENT_IMPORT_COLUMNS.map((c) => c.header);
      // Deliberately reversed order — the parser must match by header text, not position.
      const reversed = [...headers].reverse();
      const sheet = XLSX.utils.aoa_to_sheet([
        reversed,
        reversed.map((h) => (h === 'Nama Lengkap' ? 'Siti' : h === 'Jenis Kelamin' ? 'Perempuan' : '')),
      ]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Data Pasien');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      const rows = service.parseFile(buffer);
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe('Siti');
      expect(rows[0].gender).toBe('Perempuan');
    });

    it('ignores a column whose header is not part of the template (positive/edge)', () => {
      const sheet = XLSX.utils.aoa_to_sheet([
        ['Nama Lengkap', 'Jenis Kelamin', 'Kolom Aneh'],
        ['Budi', 'Laki-laki', 'sesuatu'],
      ]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Data Pasien');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      const rows = service.parseFile(buffer);
      expect(rows[0]).toEqual({ name: 'Budi', gender: 'Laki-laki' });
    });

    it('returns an empty array for a workbook with no rows (negative/edge)', () => {
      const sheet = XLSX.utils.aoa_to_sheet([PATIENT_IMPORT_COLUMNS.map((c) => c.header)]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, 'Data Pasien');
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      expect(service.parseFile(buffer)).toEqual([]);
    });
  });

  describe('importRows', () => {
    function row(overrides: Partial<Record<string, string>> = {}): PatientImportRawRow {
      return {
        name: 'Budi Santoso',
        gender: 'Laki-laki',
        ...overrides,
      };
    }

    it('creates a patient for a row with only the required fields filled (positive)', async () => {
      patientsService.create.mockResolvedValue({ id: 1, name: 'Budi Santoso', noRm: '000001' });

      const summary = await service.importRows(1, [row()]);

      expect(summary).toEqual({
        totalRows: 1,
        created: 1,
        failed: 0,
        results: [{ row: 2, name: 'Budi Santoso', noRm: '000001', status: 'created' }],
      });
      expect(patientsService.create).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ name: 'Budi Santoso', gender: Gender.MALE }),
        undefined,
      );
    });

    it('passes the spreadsheet noRm through as an override so the clinic keeps its old RM numbers (positive)', async () => {
      patientsService.create.mockResolvedValue({ id: 1, name: 'Budi', noRm: 'OLD-0042' });

      await service.importRows(1, [row({ noRm: 'OLD-0042' })]);

      expect(patientsService.create).toHaveBeenCalledWith(1, expect.anything(), 'OLD-0042');
    });

    it('translates every mapped label field to its backend enum/boolean value (positive)', async () => {
      patientsService.create.mockResolvedValue({ id: 1, name: 'Ani', noRm: '000002' });

      await service.importRows(1, [
        row({
          name: 'Ani',
          gender: 'Perempuan',
          maritalStatus: 'Menikah',
          golonganDarah: 'o',
          rhesus: 'Positif',
          punyaAlergi: 'Ya',
          catatanAlergi: 'Alergi penisilin',
          riwayatHipertensi: 'Tidak',
          riwayatDiabetes: 'ya',
          riwayatParuParu: 'TIDAK',
        }),
      ]);

      expect(patientsService.create).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          gender: Gender.FEMALE,
          maritalStatus: 'married',
          golonganDarah: 'O',
          rhesus: 'positive',
          punyaAlergi: true,
          catatanAlergi: 'Alergi penisilin',
          riwayatHipertensi: false,
          riwayatDiabetes: true,
          riwayatParuParu: false,
        }),
        undefined,
      );
    });

    it('fails the row without calling create when Nama Lengkap is missing (negative)', async () => {
      const summary = await service.importRows(1, [row({ name: '' })]);

      expect(patientsService.create).not.toHaveBeenCalled();
      expect(summary.created).toBe(0);
      expect(summary.failed).toBe(1);
      expect(summary.results[0].status).toBe('failed');
    });

    it('fails the row without calling create when Jenis Kelamin is missing (negative)', async () => {
      const summary = await service.importRows(1, [row({ gender: '' })]);

      expect(patientsService.create).not.toHaveBeenCalled();
      expect(summary.failed).toBe(1);
    });

    it('fails the row with a precise message when Jenis Kelamin has an unrecognized value, without calling create (negative)', async () => {
      const summary = await service.importRows(1, [row({ gender: 'Alien' })]);

      expect(patientsService.create).not.toHaveBeenCalled();
      expect(summary.results[0].message).toContain('Jenis Kelamin tidak valid: "Alien"');
    });

    it('fails the row when NIK is not 16 digits, via the same validator the manual form uses (negative)', async () => {
      const summary = await service.importRows(1, [row({ nik: '12345' })]);

      expect(patientsService.create).not.toHaveBeenCalled();
      expect(summary.results[0].status).toBe('failed');
      expect(summary.results[0].message).toContain('NIK');
    });

    it('fails the row when Punya Alergi has an unrecognized Ya/Tidak value, rather than silently defaulting it (negative)', async () => {
      const summary = await service.importRows(1, [row({ punyaAlergi: 'kadang' })]);

      expect(patientsService.create).not.toHaveBeenCalled();
      expect(summary.results[0].message).toContain('Punya Alergi tidak valid: "kadang"');
    });

    it('records a row as failed with the service error message, without throwing, when create() rejects (negative)', async () => {
      patientsService.create.mockRejectedValue(new ConflictException('NIK sudah terdaftar'));

      const summary = await service.importRows(1, [row()]);

      expect(summary.created).toBe(0);
      expect(summary.failed).toBe(1);
      expect(summary.results[0].message).toBe('NIK sudah terdaftar');
    });

    it('skips a fully blank row without counting it in totalRows (edge)', async () => {
      const summary = await service.importRows(1, [{}]);

      expect(patientsService.create).not.toHaveBeenCalled();
      expect(summary).toEqual({ totalRows: 0, created: 0, failed: 0, results: [] });
    });

    it('processes every row independently — one failure does not stop the rest of the batch (positive/negative mix)', async () => {
      patientsService.create
        .mockResolvedValueOnce({ id: 1, name: 'Budi', noRm: '000001' })
        .mockRejectedValueOnce(new ConflictException('NIK sudah terdaftar'))
        .mockResolvedValueOnce({ id: 3, name: 'Citra', noRm: '000003' });

      const summary = await service.importRows(1, [
        row({ name: 'Budi' }),
        row({ name: 'Ani', gender: 'INVALID' }),
        row({ name: 'Duplikat NIK', nik: '3171234567890001' }),
        row({ name: 'Citra' }),
      ]);

      expect(patientsService.create).toHaveBeenCalledTimes(3); // the invalid-gender row never reaches create()
      expect(summary.totalRows).toBe(4);
      expect(summary.created).toBe(2);
      expect(summary.failed).toBe(2);
      expect(summary.results.map((r) => r.status)).toEqual(['created', 'failed', 'failed', 'created']);
    });
  });
});
