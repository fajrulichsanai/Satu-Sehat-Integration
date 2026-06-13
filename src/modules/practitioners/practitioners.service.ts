import {
  Injectable,
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
  constructor(
    @InjectRepository(Practitioner)
    private practitionerRepository: Repository<Practitioner>,
  ) {}

  /**
   * Get all practitioners in clinic
   */
  async findAll(clinicId: number) {
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
    const practitioner = await this.practitionerRepository.findOne({
      where: { id, clinicId },
    });

    if (!practitioner) {
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
  async create(dto: CreatePractitionerDto, clinicId: number, createdBy: number) {
    // Check if NIK already exists in this clinic
    const existing = await this.practitionerRepository.findOne({
      where: { nik: dto.nik, clinicId },
    });

    if (existing) {
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
    const practitioner = await this.practitionerRepository.findOne({
      where: { id, clinicId },
    });

    if (!practitioner) {
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
    const practitioner = await this.practitionerRepository.findOne({
      where: { id, clinicId },
    });

    if (!practitioner) {
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
