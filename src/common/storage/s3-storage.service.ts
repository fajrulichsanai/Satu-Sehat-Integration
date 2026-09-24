import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join, normalize, sep } from 'path';

/** Where public files land when S3 isn't configured; served by FilesController. */
export const LOCAL_PUBLIC_DIR = join(process.cwd(), 'uploads', 'public');
/** URL prefix (relative to the API) for locally stored public files. */
export const LOCAL_PUBLIC_PREFIX = '/files/';

/**
 * Upload ke object storage S3-compatible (dipakai untuk idCloudHost IS3).
 * Butuh S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY di .env. Kalau
 * salah satu belum diisi, file disimpan di disk server (uploads/public) dan
 * disajikan lewat GET /files/* — jadi upload tetap jalan sampai S3 disiapkan.
 */
@Injectable()
export class S3StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private client: S3Client | null = null;
  private readonly endpoint: string;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.endpoint = (
      this.configService.get<string>('S3_ENDPOINT') || ''
    ).replace(/\/+$/, '');
    this.bucket = this.configService.get<string>('S3_BUCKET') || '';
    this.publicBaseUrl = `${this.endpoint}/${this.bucket}`;
  }

  private isS3Configured(): boolean {
    return !!(
      this.endpoint &&
      this.bucket &&
      this.configService.get<string>('S3_ACCESS_KEY') &&
      this.configService.get<string>('S3_SECRET_KEY')
    );
  }

  private getClient(): S3Client {
    if (this.client) return this.client;

    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY')!;
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY')!;

    this.client = new S3Client({
      endpoint: this.endpoint,
      region: this.configService.get<string>('S3_REGION') || 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
    return this.client;
  }

  /**
   * Upload buffer, kembalikan URL publik-nya: URL S3 absolut, atau — tanpa
   * S3 — path relatif ke API (`/files/<key>`).
   */
  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    if (!this.isS3Configured()) {
      return this.saveLocally(key, buffer);
    }
    const client = this.getClient();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          ACL: 'public-read',
        }),
      );
    } catch (err) {
      this.logger.error(
        `Gagal upload ke S3 | key=${key}`,
        err instanceof Error ? err.stack : err,
      );
      throw new InternalServerErrorException(
        'Gagal mengunggah file ke storage',
      );
    }
    return `${this.publicBaseUrl}/${key}`;
  }

  private async saveLocally(key: string, buffer: Buffer): Promise<string> {
    const path = resolveLocalPublicPath(key);
    if (!path) {
      throw new InternalServerErrorException('Nama file tidak valid');
    }
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, buffer);
    } catch (err) {
      this.logger.error(
        `Gagal menyimpan file lokal | key=${key}`,
        err instanceof Error ? err.stack : err,
      );
      throw new InternalServerErrorException('Gagal mengunggah file');
    }
    this.logger.warn(
      `S3 belum dikonfigurasi — file disimpan lokal di server | key=${key}`,
    );
    return `${LOCAL_PUBLIC_PREFIX}${key}`;
  }
}

/** Maps a storage key to a path inside LOCAL_PUBLIC_DIR, or null if the key
 * would escape it (`..`, absolute paths). */
export function resolveLocalPublicPath(key: string): string | null {
  const path = normalize(join(LOCAL_PUBLIC_DIR, key));
  return path.startsWith(LOCAL_PUBLIC_DIR + sep) ? path : null;
}

/**
 * Reads a file previously returned by uploadBuffer when it was stored
 * locally (for server-side use, e.g. embedding the clinic logo in PDFs).
 * Returns null for S3 URLs or missing files.
 */
export async function readLocalPublicFile(url: string): Promise<Buffer | null> {
  if (!url.startsWith(LOCAL_PUBLIC_PREFIX)) return null;
  const path = resolveLocalPublicPath(url.slice(LOCAL_PUBLIC_PREFIX.length));
  if (!path) return null;
  return readFile(path).catch(() => null);
}
