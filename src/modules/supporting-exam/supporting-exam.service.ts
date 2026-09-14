import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { SupportingExamImage } from './entities/supporting-exam-image.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { CreateSupportingExamImageDto } from './dto/supporting-exam-image.dto';
import { supportingExamFileToUrl } from './upload/supporting-exam-image.storage';

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
    const filePath = join(process.cwd(), image.fileUrl.replace(/^\//, ''));
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
