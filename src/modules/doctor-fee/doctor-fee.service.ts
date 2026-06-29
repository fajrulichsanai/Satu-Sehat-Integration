import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorFeeConfig } from './entities/doctor-fee-config.entity';
import { UpsertDoctorFeeConfigDto } from './dto/doctor-fee-config.dto';

@Injectable()
export class DoctorFeeService {
  private readonly logger = new Logger(DoctorFeeService.name);

  constructor(
    @InjectRepository(DoctorFeeConfig)
    private readonly repo: Repository<DoctorFeeConfig>,
  ) {}

  async listConfigs(clinicId: number) {
    const configs = await this.repo.find({
      where: { clinicId },
      relations: { tarif: true },
      order: { updatedAt: 'DESC' },
    });

    return {
      success: true,
      data: configs.map((c) => ({
        id: c.id,
        tarifId: c.tarifId,
        tarifName: c.tarif?.name ?? '',
        feeType: c.feeType,
        feeValue: Number(c.feeValue),
        isActive: c.isActive,
        updatedAt: c.updatedAt,
      })),
    };
  }

  async upsertConfig(
    dto: UpsertDoctorFeeConfigDto,
    clinicId: number,
    updatedBy: number,
  ) {
    let config = await this.repo.findOne({
      where: { clinicId, tarifId: dto.tarifId },
    });

    if (config) {
      Object.assign(config, {
        feeType: dto.feeType,
        feeValue: dto.feeValue,
        isActive: dto.isActive ?? config.isActive,
        updatedBy,
      });
    } else {
      config = this.repo.create({
        clinicId,
        tarifId: dto.tarifId,
        feeType: dto.feeType,
        feeValue: dto.feeValue,
        isActive: dto.isActive ?? true,
        createdBy: updatedBy,
        updatedBy,
      });
    }

    await this.repo.save(config);
    this.logger.log(
      `[UPSERT] Konfigurasi fee disimpan | tarifId=${dto.tarifId}, clinicId=${clinicId}`,
    );

    return {
      success: true,
      data: config,
      message: 'Konfigurasi fee berhasil disimpan',
    };
  }
}
