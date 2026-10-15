import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { stat } from 'fs/promises';
import { join } from 'path';
import { StorageKind } from './storage-usage.entity';
import { StorageQuotaService } from './storage-quota.service';
import {
  LOCAL_PUBLIC_PREFIX,
  resolveLocalPublicPath,
} from '../../common/storage/s3-storage.service';

const BATCH = 500;

/**
 * Keeps storage_usage in step with the files that exist: records files
 * uploaded before metering existed (or whose recording failed) and drops
 * rows whose file is gone. Runs daily and once at startup, in batches.
 */
@Injectable()
export class StorageReconcileService {
  private readonly logger = new Logger(StorageReconcileService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly quota: StorageQuotaService,
  ) {}

  /** Size of a stored file, or null when it can't be found. */
  async sizeOf(ref: string): Promise<number | null> {
    try {
      if (ref.startsWith(LOCAL_PUBLIC_PREFIX)) {
        const path = resolveLocalPublicPath(
          ref.slice(LOCAL_PUBLIC_PREFIX.length),
        );
        return path ? (await stat(path)).size : null;
      }
      if (ref.startsWith('/uploads/') && !ref.includes('..')) {
        return (await stat(join(process.cwd(), ref.replace(/^\//, '')))).size;
      }
      if (/^https?:\/\//.test(ref)) {
        const res = await fetch(ref, {
          method: 'HEAD',
          signal: AbortSignal.timeout(10_000),
        });
        const len = Number(res.headers.get('content-length'));
        return res.ok && Number.isFinite(len) ? len : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async reconcile(): Promise<{ added: number; removed: number }> {
    let added = 0;
    try {
      const exams: { ref: string; clinicId: number }[] =
        await this.dataSource.query(
          `SELECT i.file_url AS ref, e.clinic_id AS clinicId
           FROM supporting_exam_images i
           JOIN encounters e ON e.id = i.encounter_id
           LEFT JOIN storage_usage s ON s.kind = ? AND s.ref = i.file_url
          WHERE s.id IS NULL AND i.file_url IS NOT NULL
          LIMIT ${BATCH}`,
          [StorageKind.SUPPORTING_EXAM],
        );
      for (const row of exams) {
        const size = await this.sizeOf(row.ref);
        if (size !== null) {
          await this.quota.record(
            Number(row.clinicId),
            StorageKind.SUPPORTING_EXAM,
            row.ref,
            size,
          );
          added += 1;
        }
      }

      const contents: { ref: string; clinicId: number }[] =
        await this.dataSource.query(
          `SELECT u.ref, u.clinicId FROM (
            SELECT clinic_id AS clinicId, before_image_url AS ref FROM clinic_contents WHERE before_image_url IS NOT NULL
            UNION SELECT clinic_id, after_image_url FROM clinic_contents WHERE after_image_url IS NOT NULL
            UNION SELECT clinic_id, image_url FROM clinic_contents WHERE image_url IS NOT NULL
          ) u
          LEFT JOIN storage_usage s ON s.kind = ? AND s.ref = u.ref
         WHERE s.id IS NULL
         LIMIT ${BATCH}`,
          [StorageKind.CONTENT],
        );
      for (const row of contents) {
        const size = await this.sizeOf(row.ref);
        if (size !== null) {
          await this.quota.record(
            Number(row.clinicId),
            StorageKind.CONTENT,
            row.ref,
            size,
          );
          added += 1;
        }
      }

      // Exam images are deleted with their file; a ledger row without its
      // image row is stale.
      const result = await this.dataSource.query(
        `DELETE s FROM storage_usage s
           LEFT JOIN supporting_exam_images i ON i.file_url = s.ref
          WHERE s.kind = ? AND i.id IS NULL`,
        [StorageKind.SUPPORTING_EXAM],
      );
      const removed = Number(result?.affectedRows ?? 0);
      if (added || removed) {
        this.logger.log(
          `Storage disesuaikan: ${added} file dicatat, ${removed} catatan usang dihapus`,
        );
      }
      return { added, removed };
    } catch (error) {
      this.logger.error(
        `Gagal menyesuaikan catatan storage: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { added, removed: 0 };
    }
  }
}
