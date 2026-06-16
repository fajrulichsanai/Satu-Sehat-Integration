import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Diagnosis } from './entities/diagnosis.entity';
import { Encounter } from '../encounters/entities/encounter.entity';
import { EncounterStatus } from '../../enums';
import { ClinicalStatus, DiagnosisCategory } from './entities/diagnosis.entity';
import { CreateDiagnosisDto } from './dto/diagnosis.dto';

@Injectable()
export class DiagnosesService {
  private readonly logger = new Logger(DiagnosesService.name);

  constructor(
    @InjectRepository(Diagnosis)
    private readonly diagnosisRepository: Repository<Diagnosis>,
    @InjectRepository(Encounter)
    private readonly encounterRepository: Repository<Encounter>,
  ) {}

  async findAll(encounterId: number, clinicId: number) {
    this.logger.log(`[GET-ALL] Mengambil daftar diagnosis | encounterId=${encounterId}, clinicId=${clinicId}`);
    await this.verifyEncounter(encounterId, clinicId);
    return this.diagnosisRepository.find({
      where: { encounterId },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
  }

  async create(
    encounterId: number,
    clinicId: number,
    dto: CreateDiagnosisDto,
    userId: number,
  ) {
    this.logger.log(`[CREATE] Menambah diagnosis | encounterId=${encounterId}, clinicId=${clinicId}, icd10=${dto.icd10Code}`);
    const encounter = await this.verifyEncounter(encounterId, clinicId);

    if (encounter.status === EncounterStatus.FINISHED) {
      throw new ForbiddenException(
        'Tidak dapat menambah diagnosis pada encounter yang sudah selesai',
      );
    }

    if (dto.isPrimary) {
      const existingPrimary = await this.diagnosisRepository.findOne({
        where: { encounterId, isPrimary: true },
      });
      if (existingPrimary) {
        throw new BadRequestException(
          'Sudah ada diagnosis primer. Hapus atau ubah terlebih dahulu.',
        );
      }
    }

    const diagnosis = this.diagnosisRepository.create({
      encounterId,
      icd10Code: dto.icd10Code,
      icd10Display: dto.icd10Display,
      clinicalStatus: dto.clinicalStatus || ClinicalStatus.ACTIVE,
      category: dto.category || DiagnosisCategory.ENCOUNTER_DIAGNOSIS,
      bodySiteCode: dto.bodySiteCode,
      bodySiteDisplay: dto.bodySiteDisplay,
      onsetDate: dto.onsetDate ? new Date(dto.onsetDate) : undefined,
      note: dto.note,
      isPrimary: dto.isPrimary || false,
      createdBy: userId,
    });

    const saved = await this.diagnosisRepository.save(diagnosis);
    this.logger.log(`[CREATE] Diagnosis berhasil ditambahkan | id=${saved.id}, encounterId=${encounterId}`);
    return saved;
  }

  async remove(
    encounterId: number,
    diagnosisId: number,
    clinicId: number,
  ): Promise<void> {
    this.logger.log(`[DELETE] Menghapus diagnosis | diagnosisId=${diagnosisId}, encounterId=${encounterId}`);
    const encounter = await this.verifyEncounter(encounterId, clinicId);

    if (encounter.status === EncounterStatus.FINISHED) {
      throw new ForbiddenException(
        'Tidak dapat menghapus diagnosis pada encounter yang sudah selesai',
      );
    }

    const diagnosis = await this.diagnosisRepository.findOne({
      where: { id: diagnosisId, encounterId },
    });
    if (!diagnosis) {
      throw new NotFoundException(
        `Diagnosis dengan ID ${diagnosisId} tidak ditemukan`,
      );
    }

    await this.diagnosisRepository.remove(diagnosis);
    this.logger.log(`[DELETE] Diagnosis berhasil dihapus | diagnosisId=${diagnosisId}`);
  }

  private async verifyEncounter(
    encounterId: number,
    clinicId: number,
  ): Promise<Encounter> {
    const encounter = await this.encounterRepository.findOne({
      where: { id: encounterId, clinicId },
    });
    if (!encounter) {
      throw new NotFoundException(
        `Encounter dengan ID ${encounterId} tidak ditemukan`,
      );
    }
    return encounter;
  }
}
