import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { seedTerminology } from './terminology-seed';

/**
 * Memastikan data diagnosis (ICD-10 & SNOMED CT) ada di database, otomatis
 * saat aplikasi start. Berjalan di latar belakang (tidak menahan startup),
 * satu proses saja (GET_LOCK), dan murah bila data sudah terbaru. Mematikan:
 * TERMINOLOGY_AUTOSEED=false.
 */
@Injectable()
export class TerminologySeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TerminologySeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  onApplicationBootstrap(): void {
    if (
      process.env.NODE_ENV === 'test' ||
      process.env.TERMINOLOGY_AUTOSEED === 'false'
    ) {
      return;
    }
    // Beri waktu aplikasi siap melayani permintaan dulu.
    setTimeout(() => void this.run(), 5000).unref();
  }

  async run(): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      const [{ got }] = (await runner.query(
        "SELECT GET_LOCK('apex_terminology_seed', 0) AS got",
      )) as Array<{ got: number | string }>;
      if (Number(got) !== 1) return; // proses lain sedang memuat
      try {
        await seedTerminology(this.dataSource, (m) => this.logger.log(m));
      } finally {
        await runner.query("SELECT RELEASE_LOCK('apex_terminology_seed')");
      }
    } catch (err) {
      this.logger.error(
        `Gagal memuat data diagnosis: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      await runner.release();
    }
  }
}
