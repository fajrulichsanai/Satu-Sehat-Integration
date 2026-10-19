import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { S3StorageService } from '../../common/storage/s3-storage.service';
import { ContentTemplatesService } from './content-templates.service';
import { Clinic } from '../clinics/entities/clinic.entity';
import { ClinicContent, ContentStatus } from './entities/clinic-content.entity';
import { ContentPhoto as ContentPhotoRow, ContentPhotoSource } from './entities/content-photo.entity';
import {
  ContentQueryDto,
  CreateContentDto,
  UpdateContentDto,
} from './dto/content.dto';
import { AddContentPhotoDto } from './dto/content-photo.dto';
import { StorageQuotaService } from '../storage-quota/storage-quota.service';
import { StorageKind } from '../storage-quota/storage-usage.entity';
import { ClinicalPhotosService } from '../clinical-photos/clinical-photos.service';
import { SupportingExamService } from '../supporting-exam/supporting-exam.service';

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
    @InjectRepository(ContentPhotoRow)
    private readonly photoRepo: Repository<ContentPhotoRow>,
    private readonly storage: S3StorageService,
    private readonly templates: ContentTemplatesService,
    private readonly clinicalPhotos: ClinicalPhotosService,
    private readonly supportingExam: SupportingExamService,
    @Optional() private readonly storageQuota?: StorageQuotaService,
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
    await this.storageQuota?.assertRoom(clinicId, file.size);
    const ext = extname(file.originalname).toLowerCase();
    const url = await this.storage.uploadBuffer(
      `${keyPrefix(clinicId)}${randomUUID()}${ext}`,
      file.buffer,
      MIME[ext] ?? file.mimetype,
    );
    await this.storageQuota?.record(clinicId, StorageKind.CONTENT, url, file.size);
    return { url };
  }

  async create(clinicId: number, userId: number, dto: CreateContentDto) {
    this.assertOwnImages(clinicId, dto);
    await this.templates.assertOwned(clinicId, dto.templateId);
    return this.repo.save(
      this.repo.create({
        clinicId,
        templateId: dto.templateId ?? null,
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
    if (dto.templateId !== undefined) {
      await this.templates.assertOwned(clinicId, dto.templateId);
      content.templateId = dto.templateId ?? null;
    }
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
      relations: { template: true },
      order: { publishedAt: 'DESC' },
      take: 100,
    });
    return rows.map((c) => ({
      id: c.id,
      title: c.title,
      caption: c.caption,
      // The treatment group (template), for a gallery per treatment.
      treatment: c.template
        ? { id: c.template.id, name: c.template.name }
        : null,
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

  // ---------- Foto folder (layout "series") ----------

  /**
   * Folder pasien untuk dipilih sebagai foto konten: folder Fase 1 (sudah
   * consent) + folder "Pemeriksaan Penunjang" (rontgen/foto yang sudah ada,
   * sama-sama butuh consent). Tidak menyalin file, hanya menunjuk.
   */
  async pickerForPatient(patientId: number, clinicId: number) {
    const consented = await this.clinicalPhotos.isConsented(patientId, clinicId);
    if (!consented) {
      return { consentMarketing: false, folders: [], supportingExam: [] };
    }
    const gallery = await this.clinicalPhotos.listForPatient(patientId, clinicId);
    const supportingExam = await this.supportingExam.listByPatient(patientId, clinicId);
    return {
      consentMarketing: true,
      folders: gallery.folders,
      supportingExam,
    };
  }

  async listPhotos(contentId: number, clinicId: number) {
    await this.findOne(contentId, clinicId);
    return this.photoRepo.find({
      where: { contentId },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async addPhoto(
    contentId: number,
    clinicId: number,
    dto: AddContentPhotoDto,
  ): Promise<ContentPhotoRow> {
    await this.findOne(contentId, clinicId);
    if (dto.sourceType === ContentPhotoSource.PATIENT_PHOTO) {
      const photo = await this.clinicalPhotos.findByIdForClinic(dto.sourceId, clinicId);
      if (!photo) throw new BadRequestException('Foto tidak ditemukan');
    } else {
      const image = await this.supportingExam.findByIdForClinic(dto.sourceId, clinicId);
      if (!image) throw new BadRequestException('Gambar tidak ditemukan');
    }
    const count = await this.photoRepo.count({ where: { contentId } });
    const row = this.photoRepo.create({
      contentId,
      sourceType: dto.sourceType,
      sourceId: dto.sourceId,
      sortOrder: count,
      caption: dto.caption?.trim() || null,
      blurFace: dto.blurFace ?? false,
    });
    return this.photoRepo.save(row);
  }

  async removePhoto(contentId: number, clinicId: number, photoId: number) {
    await this.findOne(contentId, clinicId);
    const row = await this.photoRepo.findOne({ where: { id: photoId, contentId } });
    if (!row) throw new NotFoundException('Foto konten tidak ditemukan');
    await this.photoRepo.remove(row);
  }

  async reorderPhotos(contentId: number, clinicId: number, orderedIds: number[]) {
    await this.findOne(contentId, clinicId);
    const rows = await this.photoRepo.find({ where: { contentId } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const updates: ContentPhotoRow[] = [];
    orderedIds.forEach((id, index) => {
      const row = byId.get(id);
      if (row && row.sortOrder !== index) {
        row.sortOrder = index;
        updates.push(row);
      }
    });
    if (updates.length) await this.photoRepo.save(updates);
    return this.listPhotos(contentId, clinicId);
  }

  async readContentPhotoFile(contentId: number, clinicId: number, photoId: number) {
    await this.findOne(contentId, clinicId);
    const row = await this.photoRepo.findOne({ where: { id: photoId, contentId } });
    if (!row) throw new NotFoundException('Foto konten tidak ditemukan');
    const { absolutePath } =
      row.sourceType === ContentPhotoSource.PATIENT_PHOTO
        ? await this.clinicalPhotos.getFilePathById(row.sourceId, clinicId)
        : await this.supportingExam.getFilePathById(row.sourceId, clinicId);
    return absolutePath;
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
