import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Practitioner } from './entities/practitioner.entity';
import {
  CreatePractitionerDto,
  UpdatePractitionerDto,
  SearchSatusehatPractitionerDto,
} from './dto/practitioner.dto';

@Injectable()
export class PractitionersService {
  private readonly logger = new Logger(PractitionersService.name);

  constructor(
    @InjectRepository(Practitioner)
    private practitionerRepository: Repository<Practitioner>,
  ) {}

  /**
   * Get all practitioners in clinic
   */
  async findAll(clinicId: number) {
    this.logger.log(`[GET-ALL] Mengambil daftar practitioner | clinicId=${clinicId}`);
    const practitioners = await this.practitionerRepository.find({
      where: { clinicId },
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      data: practitioners,
    };
  }

  /**
   * Get practitioner by ID
   */
  async findOne(id: number, clinicId: number) {
    this.logger.log(`[GET] Mengambil data practitioner | id=${id}, clinicId=${clinicId}`);
    const practitioner = await this.practitionerRepository.findOne({
      where: { id, clinicId },
    });

    if (!practitioner) {
      this.logger.warn(`[GET] Practitioner tidak ditemukan | id=${id}, clinicId=${clinicId}`);
      throw new NotFoundException({
        success: false,
        error: {
          code: 'PRACTITIONER_NOT_FOUND',
          message: 'Practitioner tidak ditemukan',
        },
      });
    }

    return {
      success: true,
      data: practitioner,
    };
  }

  /**
   * Register new practitioner
   */
  async create(
    dto: CreatePractitionerDto,
    clinicId: number,
    createdBy: number,
  ) {
    this.logger.log(`[CREATE] Mendaftarkan practitioner baru | clinicId=${clinicId}, nik=${dto.nik}, name=${dto.name}`);
    // Check if NIK already exists in this clinic
    const existing = await this.practitionerRepository.findOne({
      where: { nik: dto.nik, clinicId },
    });

    if (existing) {
      this.logger.warn(`[CREATE] NIK practitioner sudah terdaftar | nik=${dto.nik}, clinicId=${clinicId}`);
      throw new ConflictException({
        success: false,
        error: {
          code: 'DUPLICATE_NIK',
          message: 'NIK sudah terdaftar di klinik ini',
        },
      });
    }

    const practitioner = this.practitionerRepository.create({
      ...dto,
      clinicId,
      createdBy,
      updatedBy: createdBy,
    });

    await this.practitionerRepository.save(practitioner);
    this.logger.log(`[CREATE] Practitioner berhasil didaftarkan | id=${practitioner.id}, clinicId=${clinicId}`);

    return {
      success: true,
      data: practitioner,
      message: 'Practitioner berhasil didaftarkan',
    };
  }

  /**
   * Update practitioner
   */
  async update(
    id: number,
    dto: UpdatePractitionerDto,
    clinicId: number,
    updatedBy: number,
  ) {
    this.logger.log(`[UPDATE] Memperbarui data practitioner | id=${id}, clinicId=${clinicId}`);
    const practitioner = await this.practitionerRepository.findOne({
      where: { id, clinicId },
    });

    if (!practitioner) {
      this.logger.warn(`[UPDATE] Practitioner tidak ditemukan | id=${id}, clinicId=${clinicId}`);
      throw new NotFoundException({
        success: false,
        error: {
          code: 'PRACTITIONER_NOT_FOUND',
          message: 'Practitioner tidak ditemukan',
        },
      });
    }

    Object.assign(practitioner, dto);
    practitioner.updatedBy = updatedBy;

    await this.practitionerRepository.save(practitioner);
    this.logger.log(`[UPDATE] Data practitioner berhasil diperbarui | id=${id}, clinicId=${clinicId}`);

    return {
      success: true,
      data: practitioner,
      message: 'Data practitioner berhasil diperbarui',
    };
  }

  /**
   * Delete practitioner
   */
  async remove(id: number, clinicId: number) {
    this.logger.log(`[DELETE] Menghapus practitioner | id=${id}, clinicId=${clinicId}`);
    const practitioner = await this.practitionerRepository.findOne({
      where: { id, clinicId },
    });

    if (!practitioner) {
      this.logger.warn(`[DELETE] Practitioner tidak ditemukan | id=${id}, clinicId=${clinicId}`);
      throw new NotFoundException({
        success: false,
        error: {
          code: 'PRACTITIONER_NOT_FOUND',
          message: 'Practitioner tidak ditemukan',
        },
      });
    }

    // TODO: Add validation - check if practitioner has associated encounters/patients
    // For now, allow deletion

    await this.practitionerRepository.remove(practitioner);
    this.logger.log(`[DELETE] Practitioner berhasil dihapus | id=${id}, clinicId=${clinicId}`);

    return {
      success: true,
      data: {
        message: 'Practitioner berhasil dihapus',
      },
    };
  }

  /**
   * Search practitioner in SATUSEHAT by NIK
   * TODO: Implement actual SATUSEHAT API integration
   */
  async searchSatusehat(dto: SearchSatusehatPractitionerDto, clinicId: number) {
    // Check if clinic has SATUSEHAT config
    // For now, return mock data

    // TODO: Implement actual API call to SATUSEHAT
    // POST https://api-satusehat.kemkes.go.id/fhir-r4/v1/Practitioner?identifier=https://fhir.kemkes.go.id/id/nik|{nik}

    return {
      success: true,
      data: {
        found: true,
        id: 'N10000001',
        name: `Dr. Practitioner ${dto.nik}`,
        nik: dto.nik,
        gender: 'male',
        note: 'TODO: Implement actual SATUSEHAT API call in Phase 8',
        message: 'Mock data - SATUSEHAT integration belum diimplementasikan',
      },
    };
  }
}
