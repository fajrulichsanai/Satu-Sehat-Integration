import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TerminologyConcept } from '../terminology/entities/terminology-concept.entity';
import { DENTAL_DIAGNOSES } from '../terminology/data/dental-id';
import { SOAP_PRESETS } from './presets';
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
    @InjectRepository(TerminologyConcept)
    private readonly conceptRepository: Repository<TerminologyConcept>,
  ) {}

  /**
   * Template bawaan klinik gigi, lengkap dengan diagnosis terkode. Nama
   * resmi kode diambil dari tabel terminologi; bila belum di-seed, pakai
   * nama Indonesia dari daftar terkurasi.
   */
  async presets() {
    const icd = new Set<string>();
    const snomed = new Set<string>();
    for (const p of SOAP_PRESETS) {
      icd.add(p.icd10);
      (p.extraIcd10 ?? []).forEach((c) => icd.add(c));
      if (p.snomed) snomed.add(p.snomed);
    }
    const concepts = await this.conceptRepository.find({
      where: [
        { system: 'icd10', code: In([...icd]) },
        { system: 'snomed', code: In([...snomed]) },
      ],
    });
    const display = new Map(
      concepts.map((c) => [`${c.system}:${c.code}`, c.display]),
    );
    const nameOf = (code: string) =>
      DENTAL_DIAGNOSES.find((d) => d.icd10 === code)?.nameId ?? null;
    const dx = (
      system: 'icd10' | 'snomed',
      code: string,
      nameId: string | null,
      primary: boolean,
    ) => ({
      system,
      code,
      display: display.get(`${system}:${code}`) ?? nameId ?? code,
      nameId,
      primary,
    });
    return SOAP_PRESETS.map((p) => {
      const nameId = nameOf(p.icd10);
      return {
        key: p.key,
        name: p.name,
        category: p.category,
        subjective: p.subjective,
        objective: p.objective,
        assessment: p.assessment,
        treatment: p.treatment,
        plan: p.plan,
        diagnoses: [
          dx('icd10', p.icd10, nameId, true),
          ...(p.snomed ? [dx('snomed', p.snomed, nameId, false)] : []),
          ...(p.extraIcd10 ?? []).map((c) => dx('icd10', c, nameOf(c), false)),
        ],
      };
    });
  }

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
      treatment: dto.treatment ?? null,
      diagnoses: dto.diagnoses ?? null,
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
      treatment: dto.treatment ?? template.treatment,
      diagnoses: dto.diagnoses ?? template.diagnoses,
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
