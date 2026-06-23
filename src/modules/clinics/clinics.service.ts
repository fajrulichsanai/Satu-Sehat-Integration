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
import { UpdateClinicDto } from './dto/clinic.dto';
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

  async findAllForSuperAdmin() {
    this.logger.log('[GET-ALL] Mengambil semua klinik (Super Admin)');

    const clinics = await this.clinicRepository.find({
      order: { name: 'ASC' },
    });

    return {
      success: true,
      data: clinics,
    };
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

    return {
      success: true,
      data: clinic,
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

    return {
      success: true,
      data: clinic,
      message: 'Profil klinik berhasil diperbarui',
    };
  }

}
