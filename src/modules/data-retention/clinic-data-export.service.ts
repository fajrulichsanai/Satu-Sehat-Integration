import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityMetadata } from 'typeorm';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { createReadStream, existsSync } from 'fs';
import { extname, join, normalize, sep } from 'path';
import { S3StorageService } from '../../common/storage/s3-storage.service';
import {
  EXPORT_SHEETS,
  LOOKUP_COLUMNS,
  OMIT_COLUMNS,
  SheetSpec,
  humanizeColumn,
} from './export-sheets';

const MAX_CELL_CHARS = 32000;
const UPLOADS_DIR = join(process.cwd(), 'uploads');

/** Kolom berisi URL berkas yang ikut dimasukkan ke folder berkas/ di ZIP. */
const FILE_COLUMNS: Record<string, { columns: string[]; folder: string }> = {
  clinics: { columns: ['logo_url'], folder: 'logo' },
  practitioners: { columns: ['photo_url'], folder: 'tenaga-kesehatan' },
  supporting_exam_images: { columns: ['file_url'], folder: 'foto-penunjang' },
  clinic_contents: {
    columns: ['before_image_url', 'after_image_url', 'image_url'],
    folder: 'konten',
  },
};

type Row = Record<string, unknown>;
type Lookups = Record<
  'patients' | 'practitioners' | 'users' | 'tarifs',
  Map<number, string>
>;

export interface ClinicExport {
  fileName: string;
  zip: JSZip;
  counts: Record<string, number>;
}

function safeName(value: string) {
  return (
    value
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'klinik'
  );
}

/**
 * Semua data satu klinik dalam satu ZIP yang rapi: `data-klinik.xlsx` (satu
 * sheet per jenis data, judul kolom berbahasa Indonesia, ID pasien/dokter/
 * pengguna diganti nama), folder `berkas/` (foto penunjang, konten, logo,
 * tanda tangan), dan `BACA-SAYA.txt`. Kolom rahasia (password, token,
 * kredensial SATUSEHAT) tidak pernah ikut.
 */
@Injectable()
export class ClinicDataExportService {
  private readonly logger = new Logger(ClinicDataExportService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly storage: S3StorageService,
  ) {}

  async build(clinicId: number): Promise<ClinicExport> {
    const [clinic] = (await this.dataSource.query(
      'SELECT id, name FROM clinics WHERE id = ?',
      [clinicId],
    )) as { id: number; name: string }[];
    if (!clinic) throw new NotFoundException('Klinik tidak ditemukan');

    const zip = new JSZip();
    const lookups = await this.loadLookups(clinicId);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ApexRecord';
    workbook.created = new Date();
    const summary = workbook.addWorksheet('Ringkasan');
    const counts: Record<string, number> = {};

    for (const spec of EXPORT_SHEETS) {
      const rows = await this.loadRows(spec, clinicId);
      counts[spec.title] = rows.length;
      await this.addSheet(workbook, zip, spec, rows, lookups);
    }

    const exportedAt = new Date();
    summary.columns = [
      { header: 'Data', key: 'title', width: 32 },
      { header: 'Jumlah baris', key: 'count', width: 16 },
    ];
    summary.addRow({ title: `Klinik: ${clinic.name}`, count: null });
    summary.addRow({
      title: `Diekspor: ${exportedAt.toLocaleString('id-ID')}`,
      count: null,
    });
    summary.addRow({});
    for (const [title, count] of Object.entries(counts)) {
      summary.addRow({ title, count });
    }
    this.styleHeader(summary);

    zip.file(
      'data-klinik.xlsx',
      Buffer.from(await workbook.xlsx.writeBuffer()),
    );
    zip.file('BACA-SAYA.txt', this.readme(clinic.name, exportedAt, counts));

    const date = exportedAt.toISOString().slice(0, 10);
    return {
      fileName: `data-${safeName(clinic.name)}-${date}.zip`,
      zip,
      counts,
    };
  }

  private metadataFor(table: string): EntityMetadata | undefined {
    return this.dataSource.entityMetadatas.find((m) => m.tableName === table);
  }

  private scopeSql(spec: SheetSpec, alias: string): string {
    const col = (name: string) => (alias ? `${alias}.${name}` : name);
    switch (spec.scope.kind) {
      case 'self':
        return `${col('id')} = :clinicId`;
      case 'clinic':
        return `${col('clinic_id')} = :clinicId`;
      case 'via': {
        const parentWhere = (spec.scope.parentScope ?? 'clinic_id = ?').replace(
          /\?/g,
          ':clinicId',
        );
        return `${col(spec.scope.column)} IN (SELECT id FROM ${spec.scope.parent} WHERE ${parentWhere})`;
      }
    }
  }

  /** Rows keyed by database column name, values after entity transformers (NIK terdekripsi). */
  async loadRows(spec: SheetSpec, clinicId: number): Promise<Row[]> {
    const meta = this.metadataFor(spec.table);
    if (!meta) {
      const sql = this.scopeSql(spec, '').replace(/:clinicId/g, '?');
      const count = (sql.match(/\?/g) ?? []).length;
      return (await this.dataSource.query(
        `SELECT * FROM \`${spec.table}\` WHERE ${sql} ORDER BY 1`,
        Array(count).fill(clinicId),
      )) as Row[];
    }
    const qb = this.dataSource
      .createQueryBuilder(meta.target, 't')
      .where(this.scopeSql(spec, 't'), { clinicId });
    if (meta.primaryColumns.length === 1) {
      qb.orderBy(`t.${meta.primaryColumns[0].propertyName}`, 'ASC');
    }
    const entities = await qb.getMany();
    const columns = meta.columns.filter(
      (c) => !c.relationMetadata || c.propertyName,
    );
    return entities.map((entity) => {
      const row: Row = {};
      for (const c of columns) {
        if (row[c.databaseName] !== undefined) continue;
        row[c.databaseName] = c.getEntityValue(entity) as unknown;
      }
      return row;
    });
  }

  private async loadLookups(clinicId: number): Promise<Lookups> {
    const q = async (sql: string) =>
      new Map(
        (
          (await this.dataSource.query(sql, [clinicId])) as {
            id: number;
            label: string;
          }[]
        ).map((r) => [Number(r.id), r.label]),
      );
    return {
      patients: await q(
        "SELECT id, CONCAT(COALESCE(no_rm, ''), ' · ', name) AS label FROM patients WHERE clinic_id = ?",
      ),
      practitioners: await q(
        'SELECT id, name AS label FROM practitioners WHERE clinic_id = ?',
      ),
      // Pengguna lintas klinik (mis. Super Admin) muncul di created_by; namanya saja.
      users: await q(
        "SELECT id, name AS label FROM users WHERE clinic_id = ? OR role IN ('super_admin', 'multi_clinic_owner')",
      ),
      tarifs: await q(
        'SELECT id, name AS label FROM tarifs WHERE clinic_id = ?',
      ),
    };
  }

  private async addSheet(
    workbook: ExcelJS.Workbook,
    zip: JSZip,
    spec: SheetSpec,
    rows: Row[],
    lookups: Lookups,
  ) {
    const sheet = workbook.addWorksheet(spec.title.slice(0, 31));
    const meta = this.metadataFor(spec.table);
    const keys = (
      meta
        ? [...new Set(meta.columns.map((c) => c.databaseName))]
        : Object.keys(rows[0] ?? {})
    ).filter((k) => !OMIT_COLUMNS.has(k));

    sheet.columns = keys.map((k) => ({
      header: humanizeColumn(k),
      key: k,
      width: Math.min(50, Math.max(10, humanizeColumn(k).length + 2)),
    }));

    const fileCols = FILE_COLUMNS[spec.table];
    for (const row of rows) {
      const out: Row = {};
      for (const key of keys) {
        let value = row[key];
        if (
          fileCols?.columns.includes(key) &&
          typeof value === 'string' &&
          value
        ) {
          value = await this.addFile(zip, fileCols.folder, row, key, value);
        } else if (
          LOOKUP_COLUMNS[key] &&
          value !== null &&
          value !== undefined
        ) {
          const label = lookups[LOOKUP_COLUMNS[key]].get(Number(value));
          const id = Number(value);
          value = label ? `${label} (#${id})` : `#${id}`;
        } else {
          value = this.cell(zip, spec.table, row, key, value);
        }
        out[key] = value;
      }
      sheet.addRow(out);
    }
    for (const col of sheet.columns) {
      let max = String(col.header ?? '').length;
      col.eachCell?.({ includeEmpty: false }, (cell) => {
        const len =
          cell.value instanceof Date
            ? 18
            : typeof cell.value === 'string'
              ? cell.value.length
              : 12;
        if (len > max) max = len;
      });
      col.width = Math.min(50, Math.max(10, max + 2));
    }
    this.styleHeader(sheet);
    if (keys.length) {
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: keys.length },
      };
    }
  }

  private styleHeader(sheet: ExcelJS.Worksheet) {
    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF367D2F' },
    };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  }

  private cell(
    zip: JSZip,
    table: string,
    row: Row,
    key: string,
    value: unknown,
  ): unknown {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
    if (typeof value === 'number' || typeof value === 'bigint') return value;
    if (Buffer.isBuffer(value)) return `(${value.length} byte)`;
    if (typeof value === 'object') value = JSON.stringify(value);
    let text = String(value);
    // Tanda tangan disimpan sebagai data URL — simpan sebagai gambar.
    const dataUrl = /^data:image\/(png|jpe?g|webp|svg\+xml);base64,(.+)$/s.exec(
      text,
    );
    if (dataUrl) {
      const ext =
        dataUrl[1] === 'svg+xml' ? 'svg' : dataUrl[1].replace('jpeg', 'jpg');
      const path = `berkas/tanda-tangan/${table}-${Number(row.id)}-${key}.${ext}`;
      zip.file(path, Buffer.from(dataUrl[2], 'base64'));
      return path;
    }
    if (text.length > MAX_CELL_CHARS) {
      text = `${text.slice(0, MAX_CELL_CHARS)}… (dipotong)`;
    }
    return text;
  }

  /** Copies an uploaded file into berkas/<folder>/ and returns its path in the ZIP. */
  private async addFile(
    zip: JSZip,
    folder: string,
    row: Row,
    key: string,
    url: string,
  ): Promise<string> {
    const original =
      typeof row.original_name === 'string'
        ? `-${safeName(row.original_name)}`
        : '';
    const ext = extname(url.split('?')[0]).slice(0, 6) || '.bin';
    const name = original && extname(original) ? original : `${original}${ext}`;
    const path = `berkas/${folder}/${Number(row.id)}-${key.replace(/_url$/, '')}${name}`;
    try {
      if (url.startsWith('/uploads/')) {
        const local = normalize(join(process.cwd(), url.replace(/^\//, '')));
        if (local.startsWith(UPLOADS_DIR + sep) && existsSync(local)) {
          zip.file(path, createReadStream(local));
          return path;
        }
        return `${url} (berkas tidak ditemukan)`;
      }
      const buffer = await this.storage.readUploaded(url);
      if (buffer) {
        zip.file(path, buffer);
        return path;
      }
    } catch (err) {
      this.logger.warn(`Gagal menyertakan berkas ${url}: ${String(err)}`);
    }
    return url;
  }

  private readme(name: string, at: Date, counts: Record<string, number>) {
    const lines = Object.entries(counts)
      .filter(([, n]) => n > 0)
      .map(([title, n]) => `  - ${title}: ${n} baris`);
    return [
      `Data klinik ${name}`,
      `Diekspor dari ApexRecord pada ${at.toLocaleString('id-ID')}.`,
      '',
      'Isi:',
      '- data-klinik.xlsx — satu sheet per jenis data. Buka dengan Excel,',
      '  Google Sheets, atau LibreOffice. Sheet "Ringkasan" berisi jumlah baris.',
      '- berkas/ — foto pemeriksaan penunjang, foto konten, logo, foto tenaga',
      '  kesehatan, dan tanda tangan. Kolom berkas di Excel menunjuk ke file ini.',
      '',
      'Data yang terisi:',
      ...lines,
      '',
      'Simpan berkas ini dengan aman: isinya data kesehatan pasien yang',
      'dilindungi. Rekam medis wajib disimpan klinik sesuai Permenkes',
      'No. 24 Tahun 2022 tentang Rekam Medis.',
      '',
    ].join('\r\n');
  }
}
