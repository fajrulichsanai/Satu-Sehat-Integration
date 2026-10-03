import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationalRecord } from './entities/operational-record.entity';
import {
  CreateOperationalRecordDto,
  UpdateOperationalRecordDto,
  OperationalRecordListQueryDto,
} from './dto/operational-record.dto';

@Injectable()
export class OperationalRecordsService {
  private readonly logger = new Logger(OperationalRecordsService.name);

  constructor(
    @InjectRepository(OperationalRecord)
    private readonly repo: Repository<OperationalRecord>,
  ) {}

  async list(clinicId: number, query: OperationalRecordListQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 50;

    const qb = this.repo
      .createQueryBuilder('o')
      .where('o.clinicId = :clinicId', { clinicId });

    if (query.search) {
      qb.andWhere('o.deskripsi LIKE :search', { search: `%${query.search}%` });
    }
    if (query.kategori) {
      qb.andWhere('o.kategori = :kategori', { kategori: query.kategori });
    }
    if (query.startDate) {
      qb.andWhere('o.tanggal >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      qb.andWhere('o.tanggal <= :endDate', { endDate: query.endDate });
    }

    const [data, total] = await qb
      .orderBy('o.tanggal', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      data: { data, meta: { total, page, limit } },
    };
  }

  async findOne(id: number, clinicId: number) {
    const record = await this.repo.findOne({ where: { id, clinicId } });
    if (!record) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'OPERATIONAL_RECORD_NOT_FOUND',
          message: 'Catatan operasional tidak ditemukan',
        },
      });
    }
    return { success: true, data: record };
  }

  async create(
    dto: CreateOperationalRecordDto,
    clinicId: number,
    createdBy: number,
  ) {
    const record = this.repo.create({
      ...dto,
      clinicId,
      createdBy,
      updatedBy: createdBy,
    });
    await this.repo.save(record);
    this.logger.log(
      `[CREATE] Catatan operasional dibuat | id=${record.id}, clinicId=${clinicId}`,
    );
    return {
      success: true,
      data: record,
      message: 'Catatan operasional berhasil ditambahkan',
    };
  }

  async update(
    id: number,
    dto: UpdateOperationalRecordDto,
    clinicId: number,
    updatedBy: number,
  ) {
    const record = await this.repo.findOne({ where: { id, clinicId } });
    if (!record) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'OPERATIONAL_RECORD_NOT_FOUND',
          message: 'Catatan operasional tidak ditemukan',
        },
      });
    }
    Object.assign(record, dto, { updatedBy });
    await this.repo.save(record);
    return {
      success: true,
      data: record,
      message: 'Catatan operasional berhasil diperbarui',
    };
  }

  async remove(id: number, clinicId: number) {
    const record = await this.repo.findOne({ where: { id, clinicId } });
    if (!record) {
      throw new NotFoundException({
        success: false,
        error: {
          code: 'OPERATIONAL_RECORD_NOT_FOUND',
          message: 'Catatan operasional tidak ditemukan',
        },
      });
    }
    await this.repo.remove(record);
    return { success: true, data: { success: true } };
  }
}
