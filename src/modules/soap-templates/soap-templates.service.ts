import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SoapTemplate } from './entities/soap-template.entity';
import { UserRole } from '../../enums/user-role.enum';
import {
  CreateSoapTemplateDto,
  SoapTemplateQueryDto,
  UpdateSoapTemplateDto,
} from './dto/soap-template.dto';

@Injectable()
export class SoapTemplatesService {
  constructor(
    @InjectRepository(SoapTemplate)
    private readonly templateRepository: Repository<SoapTemplate>,
  ) {}

  async findAll(clinicId: number, query: SoapTemplateQueryDto, user: any) {
    const qb = this.templateRepository
      .createQueryBuilder('t')
      .where('t.clinicId = :clinicId', { clinicId });

    if (query.type === 'shared') {
      qb.andWhere('t.isShared = true');
    } else if (query.type === 'personal') {
      qb.andWhere('t.isShared = false AND t.createdBy = :userId', {
        userId: user.userId,
      });
    } else {
      // 'all' — show shared + own personal
      qb.andWhere('(t.isShared = true OR t.createdBy = :userId)', {
        userId: user.userId,
      });
    }

    return qb
      .orderBy('t.isShared', 'DESC')
      .addOrderBy('t.name', 'ASC')
      .getMany();
  }

  async create(
    clinicId: number,
    dto: CreateSoapTemplateDto,
    user: any,
  ): Promise<SoapTemplate> {
    // Only owner can create shared templates
    if (dto.isShared && user.role !== UserRole.OWNER) {
      throw new ForbiddenException(
        'Hanya owner yang dapat membuat template bersama',
      );
    }

    const template = this.templateRepository.create({
      clinicId,
      name: dto.name,
      subjective: dto.subjective,
      objective: dto.objective,
      assessment: dto.assessment,
      plan: dto.plan,
      isShared: dto.isShared || false,
      createdBy: user.userId,
    });
    return this.templateRepository.save(template);
  }

  async update(
    id: number,
    clinicId: number,
    dto: UpdateSoapTemplateDto,
    user: any,
  ): Promise<SoapTemplate> {
    const template = await this.findOwned(id, clinicId, user);

    if (dto.isShared && user.role !== UserRole.OWNER) {
      throw new ForbiddenException(
        'Hanya owner yang dapat mengubah template menjadi bersama',
      );
    }

    Object.assign(template, {
      name: dto.name ?? template.name,
      subjective: dto.subjective ?? template.subjective,
      objective: dto.objective ?? template.objective,
      assessment: dto.assessment ?? template.assessment,
      plan: dto.plan ?? template.plan,
      isShared: dto.isShared ?? template.isShared,
      updatedBy: user.userId,
    });
    return this.templateRepository.save(template);
  }

  async remove(id: number, clinicId: number, user: any): Promise<void> {
    const template = await this.findOwned(id, clinicId, user);
    await this.templateRepository.remove(template);
  }

  private async findOwned(
    id: number,
    clinicId: number,
    user: any,
  ): Promise<SoapTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id, clinicId },
    });
    if (!template)
      throw new NotFoundException(`Template dengan ID ${id} tidak ditemukan`);
    // Owner can edit all; dokter only own
    if (user.role !== UserRole.OWNER && template.createdBy !== user.userId) {
      throw new ForbiddenException(
        'Tidak punya akses untuk mengubah template ini',
      );
    }
    return template;
  }
}
