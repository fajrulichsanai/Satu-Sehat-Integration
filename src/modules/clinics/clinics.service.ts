import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Clinic } from './entities/clinic.entity';
import { UpdateClinicDto, SatusehatConfigDto } from './dto/clinic.dto';
import { SatusehatFhirService } from '../satusehat/satusehat-fhir.service';
import { encrypt, decrypt } from '../../common/utils/crypto.util';

@Injectable()
export class ClinicsService {
  private readonly logger = new Logger(ClinicsService.name);
  private readonly encryptionKey: string;

  constructor(
    @InjectRepository(Clinic)
    private clinicRepository: Repository<Clinic>,
    private readonly configService: ConfigService,
    private readonly satusehatFhirService: SatusehatFhirService,
  ) {
    this.encryptionKey = this.configService.get<string>(
      'ENCRYPTION_KEY',
      'default-key-32-chars-padded!!!!!',
    );
  }

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
        hasSatusehatConfig: !!(
          clinic.satusehatOrgId && clinic.satusehatClientId
        ),
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

    // Create Satu Sehat resources if requested
    if (dto.createSatusehatResources && clinic.satusehatOrgId && clinic.satusehatClientId) {
      try {
        await this.createSatusehatResources(clinic, dto);
      } catch (error) {
        this.logger.error(`Failed to create Satu Sehat resources: ${error.message}`);
        throw new BadRequestException({
          success: false,
          error: {
            code: 'SATUSEHAT_RESOURCE_CREATION_FAILED',
            message: 'Gagal membuat resource di Satu Sehat',
            details: error.message,
          },
        });
      }
    }

    await this.clinicRepository.save(clinic);

    const { satusehatClientSecret, satusehatToken, ...sanitized } = clinic;

    return {
      success: true,
      data: sanitized,
      message: 'Profil klinik berhasil diperbarui',
      satusehatResources: dto.createSatusehatResources ? {
        divisiOrgId: clinic.satusehatDivisiOrgId,
        layananOrgId: clinic.satusehatLayananOrgId,
        poliLocationId: clinic.satusehatPoliLocationId,
      } : undefined,
    };
  }

  /**
   * Create Satu Sehat resources (Organization & Location)
   */
  private async createSatusehatResources(
    clinic: Clinic,
    dto: UpdateClinicDto,
  ) {
    // Validate required fields for Satu Sehat resource creation
    if (!clinic.satusehatProvinceCode || !clinic.satusehatCityCode ||
        !clinic.satusehatDistrictCode || !clinic.satusehatVillageCode) {
      throw new BadRequestException(
        'Kode wilayah (provinsi, kota, district, village) diperlukan untuk membuat resource Satu Sehat',
      );
    }

    const website = clinic.website || 'www.klinik.com';

    // Create Divisi Organization
    this.logger.log('Creating Divisi Organization in Satu Sehat...');
    const divisiOrgId = await this.satusehatFhirService.createDivisiOrganization(
      clinic.id,
      {
        orgId: clinic.satusehatOrgId,
        name: `Divisi Pelayanan Medik dan Penunjang - ${clinic.name}`,
        phone: clinic.phone,
        email: clinic.email || 'clinic@example.com',
        website,
        address: clinic.address,
        city: clinic.city,
        postalCode: clinic.postalCode || '00000',
        provinceCode: clinic.satusehatProvinceCode,
        cityCode: clinic.satusehatCityCode,
        districtCode: clinic.satusehatDistrictCode,
        villageCode: clinic.satusehatVillageCode,
      },
    );
    clinic.satusehatDivisiOrgId = divisiOrgId;
    this.logger.log(`Divisi Organization created: ${divisiOrgId}`);

    // Create Layanan Organization
    this.logger.log('Creating Layanan Organization in Satu Sehat...');
    const layananOrgId = await this.satusehatFhirService.createLayananOrganization(
      clinic.id,
      {
        orgId: clinic.satusehatOrgId,
        name: `Layanan Gigi dan Mulut - ${clinic.name}`,
        phone: clinic.phone,
        email: clinic.email || 'clinic@example.com',
        website,
        address: clinic.address,
        city: clinic.city,
        postalCode: clinic.postalCode || '00000',
        provinceCode: clinic.satusehatProvinceCode,
        cityCode: clinic.satusehatCityCode,
        districtCode: clinic.satusehatDistrictCode,
        villageCode: clinic.satusehatVillageCode,
        parentOrgId: divisiOrgId,
      },
    );
    clinic.satusehatLayananOrgId = layananOrgId;
    this.logger.log(`Layanan Organization created: ${layananOrgId}`);

    // Create Poli Location
    this.logger.log('Creating Poli Location in Satu Sehat...');
    const poliLocationId = await this.satusehatFhirService.createPoliLocation(
      clinic.id,
      {
        orgId: clinic.satusehatOrgId,
        name: `Poli Gigi dan Mulut - ${clinic.name}`,
        description: `Ruang Gigi dan Mulut, Layanan Gigi dan Mulut, ${clinic.name}`,
        phone: clinic.phone,
        email: clinic.email || 'clinic@example.com',
        website,
        latitude: -6.23,
        longitude: 106.83,
        parentOrgId: layananOrgId,
      },
    );
    clinic.satusehatPoliLocationId = poliLocationId;
    this.logger.log(`Poli Location created: ${poliLocationId}`);
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
    clinic.satusehatClientSecret = encrypt(
      dto.satusehatClientSecret,
      this.encryptionKey,
    );
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
