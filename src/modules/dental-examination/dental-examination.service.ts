import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DentalExamination } from './entities/dental-examination.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { UpsertDentalExaminationDto } from './dto/dental-examination.dto';

const FIELDS: (keyof UpsertDentalExaminationDto)[] = [
  'ohisDebris',
  'ohisCalculus',
  'gingivalIndex',
  'plaqueSurfacesWithPlaque',
  'plaqueSurfacesExamined',
  'probingDepths',
];

@Injectable()
export class DentalExaminationService {
  constructor(
    @InjectRepository(DentalExamination)
    private readonly examRepository: Repository<DentalExamination>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
  ) {}

  async findByEncounter(
    encounterId: number,
    clinicId: number,
  ): Promise<DentalExamination | null> {
    await this.assertEncounterExists(encounterId, clinicId);
    return this.examRepository.findOne({ where: { encounterId } });
  }

  async upsertForEncounter(
    encounterId: number,
    clinicId: number,
    dto: UpsertDentalExaminationDto,
    userId: number,
  ): Promise<DentalExamination> {
    await this.assertEncounterExists(encounterId, clinicId);

    let exam = await this.examRepository.findOne({ where: { encounterId } });

    if (!exam) {
      exam = this.examRepository.create({
        encounterId,
        notes: dto.notes,
        createdBy: userId,
        ...this.pick(dto),
      });
    } else {
      Object.assign(exam, {
        notes: dto.notes ?? exam.notes,
        updatedBy: userId,
        ...this.pick(dto, exam),
      });
    }

    return this.examRepository.save(exam);
  }

  private pick(
    dto: UpsertDentalExaminationDto,
    fallback?: DentalExamination,
  ): Partial<DentalExamination> {
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
