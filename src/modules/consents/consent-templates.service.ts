import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsentTemplate } from './entities/consent-template.entity';
import { UpsertConsentTemplateDto } from './dto/consent-template.dto';

@Injectable()
export class ConsentTemplatesService {
  constructor(
    @InjectRepository(ConsentTemplate)
    private readonly templateRepository: Repository<ConsentTemplate>,
  ) {}

  findAll(clinicId: number) {
    return this.templateRepository.find({
      where: { clinicId },
      relations: { tarif: true },
      order: { id: 'ASC' },
    });
  }

  async upsert(
    clinicId: number,
    tarifId: number,
    dto: UpsertConsentTemplateDto,
    userId: number,
  ) {
    const existing = await this.templateRepository.findOne({
      where: { clinicId, tarifId },
    });
    if (existing) {
      existing.title = dto.title;
      existing.content = dto.content;
      existing.updatedBy = userId;
      return this.templateRepository.save(existing);
    }
    const created = this.templateRepository.create({
      clinicId,
      tarifId,
      title: dto.title,
      content: dto.content,
      createdBy: userId,
    });
    return this.templateRepository.save(created);
  }

  async remove(clinicId: number, tarifId: number) {
    const existing = await this.templateRepository.findOne({
      where: { clinicId, tarifId },
    });
    if (!existing) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'CONSENT_TEMPLATE_NOT_FOUND',
          message: 'Template persetujuan untuk tindakan ini belum diatur',
        },
      });
    }
    await this.templateRepository.delete({ id: existing.id });
  }

  findByTarif(clinicId: number, tarifId: number) {
    return this.templateRepository.findOne({ where: { clinicId, tarifId } });
  }
}
