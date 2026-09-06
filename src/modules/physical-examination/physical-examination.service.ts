import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhysicalExamination } from './entities/physical-examination.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { UpsertPhysicalExaminationDto } from './dto/physical-examination.dto';

const FIELDS: (keyof UpsertPhysicalExaminationDto)[] = [
  'generalCondition',
  'consciousness',
  'nutritionalStatus',
  'height',
  'weight',
  'painScale',
  'painPoints',
  'bloodPressureSystolic',
  'bloodPressureDiastolic',
  'pulseRate',
  'respiratoryRate',
  'temperature',
  'oxygenSaturation',
  'cyanosis',
  'edema',
  'anemia',
  'jaundice',
  'skin',
  'lymphNodes',
  'head',
  'hair',
  'eyes',
  'ears',
  'nose',
  'mouth',
  'neck',
  'lungInspection',
  'lungPalpation',
  'lungPercussion',
  'lungAuscultation',
  'heartInspection',
  'heartPalpation',
  'heartPercussion',
  'heartAuscultation',
  'abdomenInspection',
  'abdomenPalpation',
  'abdomenPercussion',
  'abdomenAuscultation',
  'extremities',
  'genitalia',
  'rectal',
];

@Injectable()
export class PhysicalExaminationService {
  constructor(
    @InjectRepository(PhysicalExamination)
    private readonly examRepository: Repository<PhysicalExamination>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
  ) {}

  async findByEncounter(
    encounterId: number,
    clinicId: number,
  ): Promise<PhysicalExamination | null> {
    await this.assertEncounterExists(encounterId, clinicId);
    return this.examRepository.findOne({ where: { encounterId } });
  }

  async upsertForEncounter(
    encounterId: number,
    clinicId: number,
    dto: UpsertPhysicalExaminationDto,
    userId: number,
  ): Promise<PhysicalExamination> {
    await this.assertEncounterExists(encounterId, clinicId);

    let exam = await this.examRepository.findOne({ where: { encounterId } });

    if (!exam) {
      exam = this.examRepository.create({
        encounterId,
        createdBy: userId,
        ...this.pick(dto),
      });
    } else {
      Object.assign(exam, this.pick(dto, exam), { updatedBy: userId });
    }

    return this.examRepository.save(exam);
  }

  private pick(
    dto: UpsertPhysicalExaminationDto,
    fallback?: PhysicalExamination,
  ): Partial<PhysicalExamination> {
    const result: Record<string, unknown> = {};
    for (const field of FIELDS) {
      result[field] = dto[field] ?? (fallback ? fallback[field] : undefined);
    }
    return result;
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
