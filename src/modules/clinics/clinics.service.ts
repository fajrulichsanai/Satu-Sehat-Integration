import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clinic } from '../../entities/clinic.entity';
import { UpdateClinicDto, SatusehatConfigDto } from './dto/clinic.dto';

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private clinicRepository: Repository<Clinic>,
  ) {}

  /**
   * Get clinic settings
   */
  async findOne(clinicId: number) {
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });

    if (!clinic) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'CLINIC_NOT_FOUND',
          message: 'Klinik tidak ditemukan',
        },
      });
    }

    // Don't expose sensitive data
    const { satusehatClientSecret, satusehatToken, ...sanitized } = clinic;

    return {
      success: true,
      data: {
        ...sanitized,
        hasSatusehatConfig: !!(clinic.satusehatOrgId && clinic.satusehatClientId),
      },
    };
  }

  /**
   * Update clinic profile
   */
  async update(clinicId: number, dto: UpdateClinicDto, updatedBy: number) {
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });

    if (!clinic) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'CLINIC_NOT_FOUND',
          message: 'Klinik tidak ditemukan',
        },
      });
    }

    // Update fields
    Object.assign(clinic, dto);
    clinic.updatedBy = updatedBy;

    // Mark setup as complete if all required fields are filled
    if (
      clinic.name &&
      clinic.address &&
      clinic.city &&
      clinic.province &&
      clinic.phone
    ) {
      clinic.setupComplete = true;
    }

    await this.clinicRepository.save(clinic);

    const { satusehatClientSecret, satusehatToken, ...sanitized } = clinic;

    return {
      success: true,
      data: sanitized,
      message: 'Profil klinik berhasil diperbarui',
    };
  }

  /**
   * Configure SATUSEHAT integration
   */
  async configureSatusehat(
    clinicId: number,
    dto: SatusehatConfigDto,
    updatedBy: number,
  ) {
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });

    if (!clinic) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'CLINIC_NOT_FOUND',
          message: 'Klinik tidak ditemukan',
        },
      });
    }

    // Update SATUSEHAT config
    clinic.satusehatOrgId = dto.satusehatOrgId;
    clinic.satusehatClientId = dto.satusehatClientId;
    clinic.satusehatClientSecret = dto.satusehatClientSecret;
    clinic.satusehatEnvironment = dto.satusehatEnvironment;
    clinic.updatedBy = updatedBy;

    await this.clinicRepository.save(clinic);

    return {
      success: true,
      data: {
        satusehatOrgId: clinic.satusehatOrgId,
        satusehatEnvironment: clinic.satusehatEnvironment,
        message: 'Konfigurasi SATUSEHAT berhasil disimpan',
      },
    };
  }

  /**
   * Test SATUSEHAT connection
   * TODO: Implement actual OAuth2 token request to SATUSEHAT
   */
  async testSatusehatConnection(clinicId: number) {
    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });

    if (!clinic) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'CLINIC_NOT_FOUND',
          message: 'Klinik tidak ditemukan',
        },
      });
    }

    // Validate config exists
    if (
      !clinic.satusehatOrgId ||
      !clinic.satusehatClientId ||
      !clinic.satusehatClientSecret
    ) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'SATUSEHAT_CONFIG_INCOMPLETE',
          message: 'Konfigurasi SATUSEHAT belum lengkap',
        },
      });
    }

    // TODO: Implement actual OAuth2 flow
    // For now, return mock success
    return {
      success: true,
      data: {
        connected: true,
        environment: clinic.satusehatEnvironment,
        orgId: clinic.satusehatOrgId,
        message: 'Koneksi ke SATUSEHAT berhasil (mock)',
        note: 'TODO: Implement actual OAuth2 token request',
      },
    };
  }
}
