import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { SupportingExamImage } from './entities/supporting-exam-image.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { CreateSupportingExamImageDto } from './dto/supporting-exam-image.dto';
import { supportingExamFileToUrl } from './upload/supporting-exam-image.storage';
import { StorageQuotaService } from '../storage-quota/storage-quota.service';
import { StorageKind } from '../storage-quota/storage-usage.entity';

function toApiUrl(
  encounterId: number,
  image: SupportingExamImage,
): SupportingExamImage {
  if (!image.fileUrl) return image;
  return {
    ...image,
    fileUrl: `/encounters/${encounterId}/supporting-exam-images/${image.id}/file`,
  };
}

@Injectable()
export class SupportingExamService {
  constructor(
    @InjectRepository(SupportingExamImage)
    private readonly imageRepository: Repository<SupportingExamImage>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
    @Optional() private readonly storageQuota?: StorageQuotaService,
  ) {}

  async listByEncounter(
    encounterId: number,
    clinicId: number,
  ): Promise<SupportingExamImage[]> {
    await this.assertEncounterExists(encounterId, clinicId);
    const images = await this.imageRepository.find({
      where: { encounterId },
      order: { id: 'DESC' },
    });
    return images.map((image) => toApiUrl(encounterId, image));
  }

  /** Semua gambar (foto & rontgen) pasien ini, lintas kontrol — dipakai folder "Pemeriksaan Penunjang" di pemilih foto konten. */
  async listByPatient(
    patientId: number,
    clinicId: number,
  ): Promise<SupportingExamImage[]> {
    const images = await this.imageRepository
      .createQueryBuilder('image')
      .innerJoin('image.encounter', 'encounter')
      .where('encounter.patientId = :patientId', { patientId })
      .andWhere('encounter.clinicId = :clinicId', { clinicId })
      .orderBy('image.id', 'DESC')
      .getMany();
    return images.map((image) => toApiUrl(image.encounterId, image));
  }

  async create(
    encounterId: number,
    clinicId: number,
    dto: CreateSupportingExamImageDto,
    file: Express.Multer.File | undefined,
    userId: number,
  ): Promise<SupportingExamImage> {
    await this.assertEncounterExists(encounterId, clinicId);
    const fileUrl = supportingExamFileToUrl(file);
    if (!fileUrl) {
      throw new BadRequestException('Gambar wajib diunggah');
    }
    // Multer has already written the file: over quota, drop it again.
    try {
      await this.storageQuota?.assertRoom(clinicId, file?.size ?? 0);
    } catch (error) {
      this.deleteFile(fileUrl);
      throw error;
    }
    const image = this.imageRepository.create({
      encounterId,
      imageType: dto.imageType,
      category: dto.category ?? null,
      fileUrl,
      originalName: file?.originalname,
      notes: dto.notes,
      createdBy: userId,
    });
    const saved = await this.imageRepository.save(image);
    await this.storageQuota?.record(
      clinicId,
      StorageKind.SUPPORTING_EXAM,
      fileUrl,
      file?.size ?? 0,
    );
    return toApiUrl(encounterId, saved);
  }

  async remove(
    encounterId: number,
    clinicId: number,
    imageId: number,
  ): Promise<void> {
    await this.assertEncounterExists(encounterId, clinicId);
    const image = await this.imageRepository.findOne({
      where: { id: imageId, encounterId },
    });
    if (!image) {
      throw new NotFoundException(
        `Gambar dengan ID ${imageId} tidak ditemukan`,
      );
    }
    await this.imageRepository.delete({ id: imageId });
    this.deleteFile(image.fileUrl);
    await this.storageQuota?.forget(StorageKind.SUPPORTING_EXAM, image.fileUrl);
  }

  private deleteFile(fileUrl: string) {
    const filePath = join(process.cwd(), fileUrl.replace(/^\//, ''));
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  async getFilePath(
    encounterId: number,
    clinicId: number,
    imageId: number,
  ): Promise<{ absolutePath: string; originalName: string | null }> {
    await this.assertEncounterExists(encounterId, clinicId);
    const image = await this.imageRepository.findOne({
      where: { id: imageId, encounterId },
    });
    if (!image) {
      throw new NotFoundException(
        `Gambar dengan ID ${imageId} tidak ditemukan`,
      );
    }
    const absolutePath = join(process.cwd(), image.fileUrl.replace(/^\//, ''));
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File gambar tidak ditemukan');
    }
    return { absolutePath, originalName: image.originalName };
  }

  /** Dipakai saat konten menambahkan gambar ini — verifikasi klinik pemiliknya. */
  async findByIdForClinic(
    imageId: number,
    clinicId: number,
  ): Promise<SupportingExamImage | null> {
    const image = await this.imageRepository
      .createQueryBuilder('image')
      .innerJoin('image.encounter', 'encounter')
      .where('image.id = :imageId', { imageId })
      .andWhere('encounter.clinicId = :clinicId', { clinicId })
      .getOne();
    return image ?? null;
  }

  async getFilePathById(
    imageId: number,
    clinicId: number,
  ): Promise<{ absolutePath: string; originalName: string | null }> {
    const image = await this.findByIdForClinic(imageId, clinicId);
    if (!image) {
      throw new NotFoundException(`Gambar dengan ID ${imageId} tidak ditemukan`);
    }
    const absolutePath = join(process.cwd(), image.fileUrl.replace(/^\//, ''));
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('File gambar tidak ditemukan');
    }
    return { absolutePath, originalName: image.originalName };
  }

  private async assertEncounterExists(
    encounterId: number,
    clinicId: number,
  ): Promise<void> {
    const encounter = await this.encounterRepository.findOne({
      where: { id: encounterId, clinicId },
    });
    if (!encounter) {
      throw new NotFoundException(
        `Kunjungan dengan ID ${encounterId} tidak ditemukan`,
      );
    }
  }
}
