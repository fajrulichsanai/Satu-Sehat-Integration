import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentTemplate } from './entities/content-template.entity';
import {
  CreateContentTemplateDto,
  UpdateContentTemplateDto,
} from './dto/content.dto';

/** A clinic's treatment templates for Konten (one per treatment). */
@Injectable()
export class ContentTemplatesService {
  constructor(
    @InjectRepository(ContentTemplate)
    private readonly repo: Repository<ContentTemplate>,
  ) {}

  list(clinicId: number) {
    return this.repo.find({ where: { clinicId }, order: { name: 'ASC' } });
  }

  async findOne(id: number, clinicId: number) {
    const template = await this.repo.findOne({ where: { id, clinicId } });
    if (!template) throw new NotFoundException('Template tidak ditemukan');
    return template;
  }

  /** Throws unless the template exists and belongs to this clinic. */
  async assertOwned(clinicId: number, id: number | null | undefined) {
    if (!id) return;
    if (!(await this.repo.exists({ where: { id, clinicId } }))) {
      throw new BadRequestException('Template tidak ditemukan');
    }
  }

  async create(
    clinicId: number,
    userId: number,
    dto: CreateContentTemplateDto,
  ) {
    const name = dto.name.trim();
    await this.assertNameFree(clinicId, name);
    return this.repo.save(
      this.repo.create({
        clinicId,
        name,
        title: dto.title?.trim() || name,
        layout: dto.layout,
        background: dto.background,
        showDisclaimer: dto.showDisclaimer ?? true,
        settings: dto.settings ?? null,
        createdBy: userId,
        updatedBy: userId,
      }),
    );
  }

  async update(
    id: number,
    clinicId: number,
    userId: number,
    dto: UpdateContentTemplateDto,
  ) {
    const template = await this.findOne(id, clinicId);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name.toLowerCase() !== template.name.toLowerCase()) {
        await this.assertNameFree(clinicId, name);
      }
      template.name = name;
    }
    if (dto.title !== undefined)
      template.title = dto.title.trim() || template.name;
    if (dto.layout !== undefined) template.layout = dto.layout;
    if (dto.background !== undefined) template.background = dto.background;
    if (dto.showDisclaimer !== undefined)
      template.showDisclaimer = dto.showDisclaimer;
    if (dto.settings !== undefined) template.settings = dto.settings;
    template.updatedBy = userId;
    return this.repo.save(template);
  }

  /** Stories made from it stay, grouped under "Lainnya" (FK sets null). */
  async remove(id: number, clinicId: number) {
    await this.repo.remove(await this.findOne(id, clinicId));
  }

  private async assertNameFree(clinicId: number, name: string) {
    const taken = await this.repo
      .createQueryBuilder('t')
      .where('t.clinic_id = :clinicId AND LOWER(t.name) = LOWER(:name)', {
        clinicId,
        name,
      })
      .getExists();
    if (taken) throw new BadRequestException(`Template "${name}" sudah ada`);
  }
}
