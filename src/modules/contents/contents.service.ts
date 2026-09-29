import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { S3StorageService } from '../../common/storage/s3-storage.service';
import { Clinic } from '../clinics/entities/clinic.entity';
import { ClinicContent, ContentStatus } from './entities/clinic-content.entity';
import {
  ContentQueryDto,
  CreateContentDto,
  UpdateContentDto,
} from './dto/content.dto';

export type ContentPhoto = 'before' | 'after' | 'rendered';

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/** Every upload of a clinic's content lives under this key prefix. */
const keyPrefix = (clinicId: number) => `contents/${clinicId}/`;

@Injectable()
export class ContentsService {
  constructor(
    @InjectRepository(ClinicContent)
    private readonly repo: Repository<ClinicContent>,
    @InjectRepository(Clinic)
    private readonly clinicRepo: Repository<Clinic>,
    private readonly storage: S3StorageService,
  ) {}

  list(clinicId: number, query: ContentQueryDto) {
    return this.repo.find({
      where: { clinicId, ...(query.status ? { status: query.status } : {}) },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: number, clinicId: number) {
    const content = await this.repo.findOne({ where: { id, clinicId } });
    if (!content) throw new NotFoundException('Konten tidak ditemukan');
    return content;
  }

  /** Stores a photo for a story; the returned URL goes into create/update. */
  async uploadImage(clinicId: number, file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Pilih file gambar');
    const ext = extname(file.originalname).toLowerCase();
    const url = await this.storage.uploadBuffer(
      `${keyPrefix(clinicId)}${randomUUID()}${ext}`,
      file.buffer,
      MIME[ext] ?? file.mimetype,
    );
    return { url };
  }

  create(clinicId: number, userId: number, dto: CreateContentDto) {
    this.assertOwnImages(clinicId, dto);
    return this.repo.save(
      this.repo.create({
        clinicId,
        title: dto.title.trim(),
        caption: dto.caption?.trim() || null,
        layout: dto.layout,
        background: dto.background,
        showDisclaimer: dto.showDisclaimer ?? true,
        beforeImageUrl: dto.beforeImageUrl ?? null,
        afterImageUrl: dto.afterImageUrl ?? null,
        settings: dto.settings ?? null,
        status: ContentStatus.DRAFT,
        createdBy: userId,
        updatedBy: userId,
      }),
    );
  }

  /**
   * Saves edits. A published story keeps showing its last published image
   * until it is published again.
   */
  async update(
    id: number,
    clinicId: number,
    userId: number,
    dto: UpdateContentDto,
  ) {
    const content = await this.findOne(id, clinicId);
    this.assertOwnImages(clinicId, dto);
    if (dto.title !== undefined) content.title = dto.title.trim();
    if (dto.caption !== undefined)
      content.caption = dto.caption?.trim() || null;
    if (dto.layout !== undefined) content.layout = dto.layout;
    if (dto.background !== undefined) content.background = dto.background;
    if (dto.showDisclaimer !== undefined)
      content.showDisclaimer = dto.showDisclaimer;
    if (dto.beforeImageUrl !== undefined)
      content.beforeImageUrl = dto.beforeImageUrl;
    if (dto.afterImageUrl !== undefined)
      content.afterImageUrl = dto.afterImageUrl;
    if (dto.settings !== undefined) content.settings = dto.settings;
    content.updatedBy = userId;
    return this.repo.save(content);
  }

  /** Stores the story rendered by the editor and makes it public. */
  async publish(
    id: number,
    clinicId: number,
    userId: number,
    file?: Express.Multer.File,
  ) {
    const content = await this.findOne(id, clinicId);
    if (!content.beforeImageUrl || !content.afterImageUrl) {
      throw new BadRequestException(
        'Pilih foto sebelum dan sesudah sebelum mempublikasikan',
      );
    }
    const { url } = await this.uploadImage(clinicId, file);
    content.imageUrl = url;
    content.status = ContentStatus.PUBLISHED;
    content.publishedAt = new Date();
    content.updatedBy = userId;
    return this.repo.save(content);
  }

  async unpublish(id: number, clinicId: number, userId: number) {
    const content = await this.findOne(id, clinicId);
    content.status = ContentStatus.DRAFT;
    content.updatedBy = userId;
    return this.repo.save(content);
  }

  async remove(id: number, clinicId: number) {
    const content = await this.findOne(id, clinicId);
    await this.repo.remove(content);
  }

  /**
   * A photo of a story, served from the API itself so the editor can draw it
   * on a canvas and export the result (a cross-origin S3 image would taint
   * the canvas).
   */
  async readPhoto(id: number, clinicId: number, which: ContentPhoto) {
    const content = await this.findOne(id, clinicId);
    const url =
      which === 'before'
        ? content.beforeImageUrl
        : which === 'after'
          ? content.afterImageUrl
          : content.imageUrl;
    return this.readOwnFile(clinicId, url, keyPrefix(clinicId));
  }

  /** The clinic's logo, same-origin for the canvas; null if it has none. */
  async readLogo(clinicId: number) {
    const clinic = await this.clinicRepo.findOne({ where: { id: clinicId } });
    return this.readOwnFile(clinicId, clinic?.logoUrl, '');
  }

  /** Published stories for the clinic website (/v1/contents). */
  async listPublished(clinicId: number, fileBase: string) {
    const rows = await this.repo.find({
      where: { clinicId, status: ContentStatus.PUBLISHED },
      order: { publishedAt: 'DESC' },
      take: 50,
    });
    return rows.map((c) => ({
      id: c.id,
      title: c.title,
      caption: c.caption,
      imageUrl: c.imageUrl?.startsWith('/')
        ? `${fileBase}${c.imageUrl}`
        : c.imageUrl,
      publishedAt: c.publishedAt,
    }));
  }

  private async readOwnFile(
    clinicId: number,
    url: string | null | undefined,
    prefix: string,
  ) {
    if (!url || !this.storage.ownsUrl(url, prefix)) {
      throw new NotFoundException('Gambar tidak ditemukan');
    }
    const buffer = await this.storage.readUploaded(url);
    if (!buffer) throw new NotFoundException('Gambar tidak ditemukan');
    return {
      buffer,
      contentType: MIME[extname(url).toLowerCase()] ?? 'image/png',
    };
  }

  /** Only photos this clinic uploaded through /contents/images are accepted. */
  private assertOwnImages(
    clinicId: number,
    dto: { beforeImageUrl?: string | null; afterImageUrl?: string | null },
  ) {
    for (const url of [dto.beforeImageUrl, dto.afterImageUrl]) {
      if (url && !this.storage.ownsUrl(url, keyPrefix(clinicId))) {
        throw new BadRequestException(
          'Gambar tidak valid. Unggah ulang fotonya.',
        );
      }
    }
  }
}
