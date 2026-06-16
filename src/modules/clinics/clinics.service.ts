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
import { encrypt } from '../../common/utils/crypto.util';

@Injectable()
export class ClinicsService {
  private readonly logger = new Logger(ClinicsService.name);
  private readonly encryptionKey: string;

  constructor(
    @InjectRepository(Clinic)
    private clinicRepository: Repository<Clinic>,
    private readonly configService: ConfigService,
  ) {
    this.encryptionKey = this.configService.get<string>(
      'ENCRYPTION_KEY',
      'default-key-32-chars-padded!!!!!',
    );
  }

  async findOne(clinicId: number) {
    this.logger.log(`[GET] Mengambil data klinik | clinicId=${clinicId}`);

    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });

    if (!clinic) {
      this.logger.warn(`[GET] Klinik tidak ditemukan | clinicId=${clinicId}`);
      throw new NotFoundException({
        success: false,
        error: {
          code: 'CLINIC_NOT_FOUND',
          message: 'Klinik tidak ditemukan',
        },
      });
    }

    this.logger.log(`[GET] Data klinik berhasil diambil | clinicId=${clinicId}, name=${clinic.name}`);

    const {
      satusehatOrgId,
      satusehatClientId,
      satusehatClientSecret,
      satusehatEnvironment,
      satusehatToken,
      satusehatTokenExpiresAt,
      satusehatDivisiOrgId,
      satusehatLayananOrgId,
      satusehatPoliLocationId,
      satusehatProvinceCode,
      satusehatCityCode,
      satusehatDistrictCode,
      satusehatVillageCode,
      ...sanitized
    } = clinic;

    return {
      success: true,
      data: sanitized,
    };
  }

  async update(clinicId: number, dto: UpdateClinicDto, updatedBy: number) {
    this.logger.log(`[UPDATE] Memulai update profil klinik | clinicId=${clinicId}, updatedBy=${updatedBy}`);

    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });

    if (!clinic) {
      this.logger.warn(`[UPDATE] Klinik tidak ditemukan | clinicId=${clinicId}`);
      throw new NotFoundException({
        success: false,
        error: {
          code: 'CLINIC_NOT_FOUND',
          message: 'Klinik tidak ditemukan',
        },
      });
    }

    this.logger.log(`[UPDATE] Klinik ditemukan, mengaplikasikan perubahan | clinicId=${clinicId}`);
    Object.assign(clinic, dto);
    clinic.updatedBy = updatedBy;

    if (
      clinic.name &&
      clinic.address &&
      clinic.city &&
      clinic.province &&
      clinic.phone
    ) {
      clinic.setupComplete = true;
      this.logger.log(`[UPDATE] Setup klinik ditandai complete | clinicId=${clinicId}`);
    }

    this.logger.log(`[UPDATE] Menyimpan perubahan ke database | clinicId=${clinicId}`);
    await this.clinicRepository.save(clinic);

    this.logger.log(`[UPDATE] Profil klinik berhasil diperbarui | clinicId=${clinicId}`);

    const {
      satusehatOrgId,
      satusehatClientId,
      satusehatClientSecret,
      satusehatEnvironment,
      satusehatToken,
      satusehatTokenExpiresAt,
      satusehatDivisiOrgId,
      satusehatLayananOrgId,
      satusehatPoliLocationId,
      satusehatProvinceCode,
      satusehatCityCode,
      satusehatDistrictCode,
      satusehatVillageCode,
      ...sanitized
    } = clinic;

    return {
      success: true,
      data: sanitized,
      message: 'Profil klinik berhasil diperbarui',
    };
  }

  async configureSatusehat(
    clinicId: number,
    dto: SatusehatConfigDto,
    updatedBy: number,
  ) {
    this.logger.log(`[SATUSEHAT-CONFIG] Memulai konfigurasi SATUSEHAT | clinicId=${clinicId}, updatedBy=${updatedBy}`);

    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });

    if (!clinic) {
      this.logger.warn(`[SATUSEHAT-CONFIG] Klinik tidak ditemukan | clinicId=${clinicId}`);
      throw new NotFoundException({
        success: false,
        error: {
          code: 'CLINIC_NOT_FOUND',
          message: 'Klinik tidak ditemukan',
        },
      });
    }

    this.logger.log(`[SATUSEHAT-CONFIG] Menyimpan konfigurasi SATUSEHAT | clinicId=${clinicId}, orgId=${dto.satusehatOrgId}, env=${dto.satusehatEnvironment}`);
    clinic.satusehatOrgId = dto.satusehatOrgId;
    clinic.satusehatClientId = dto.satusehatClientId;
    clinic.satusehatClientSecret = encrypt(
      dto.satusehatClientSecret,
      this.encryptionKey,
    );
    clinic.satusehatEnvironment = dto.satusehatEnvironment;
    clinic.updatedBy = updatedBy;

    await this.clinicRepository.save(clinic);

    this.logger.log(`[SATUSEHAT-CONFIG] Konfigurasi SATUSEHAT berhasil disimpan | clinicId=${clinicId}`);

    return {
      success: true,
      data: {
        satusehatOrgId: clinic.satusehatOrgId,
        satusehatEnvironment: clinic.satusehatEnvironment,
        message: 'Konfigurasi SATUSEHAT berhasil disimpan',
      },
    };
  }

  async testSatusehatConnection(clinicId: number) {
    this.logger.log(`[SATUSEHAT-TEST] Memulai test koneksi SATUSEHAT | clinicId=${clinicId}`);

    const clinic = await this.clinicRepository.findOne({
      where: { id: clinicId },
    });

    if (!clinic) {
      this.logger.warn(`[SATUSEHAT-TEST] Klinik tidak ditemukan | clinicId=${clinicId}`);
      throw new NotFoundException({
        success: false,
        error: {
          code: 'CLINIC_NOT_FOUND',
          message: 'Klinik tidak ditemukan',
        },
      });
    }

    if (
      !clinic.satusehatOrgId ||
      !clinic.satusehatClientId ||
      !clinic.satusehatClientSecret
    ) {
      this.logger.warn(`[SATUSEHAT-TEST] Konfigurasi SATUSEHAT belum lengkap | clinicId=${clinicId}`);
      throw new BadRequestException({
        success: false,
        error: {
          code: 'SATUSEHAT_CONFIG_INCOMPLETE',
          message: 'Konfigurasi SATUSEHAT belum lengkap',
        },
      });
    }

    this.logger.log(`[SATUSEHAT-TEST] Test koneksi berhasil | clinicId=${clinicId}, env=${clinic.satusehatEnvironment}`);

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
