import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * Upload ke object storage S3-compatible (dipakai untuk idCloudHost IS3).
 * Butuh S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY di .env —
 * kalau salah satu belum diisi, upload gagal dengan pesan yang jelas
 * (bukan crash saat boot) supaya modul lain yang belum butuh S3 tidak ikut mati.
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

  private getClient(): S3Client {
    if (this.client) return this.client;

    const accessKeyId = this.configService.get<string>('S3_ACCESS_KEY');
    const secretAccessKey = this.configService.get<string>('S3_SECRET_KEY');

    if (!this.endpoint || !this.bucket || !accessKeyId || !secretAccessKey) {
      throw new InternalServerErrorException(
        'Konfigurasi S3 belum lengkap di server (S3_ENDPOINT/S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY)',
      );
    }

    this.client = new S3Client({
      endpoint: this.endpoint,
      region: this.configService.get<string>('S3_REGION') || 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
    return this.client;
  }

  /** Upload buffer, kembalikan URL publik-nya. */
  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
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
}
