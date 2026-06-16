import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tarif } from '../tarif/entities/tarif.entity';
import { CreateTarifDto, TarifQueryDto, UpdateTarifDto } from './dto/tarif.dto';

@Injectable()
export class TarifsService {
  private readonly logger = new Logger(TarifsService.name);

  constructor(
    @InjectRepository(Tarif)
    private readonly tarifRepository: Repository<Tarif>,
  ) {}

  async findAll(clinicId: number, query: TarifQueryDto) {
    this.logger.log(`[GET-ALL] Mengambil daftar tarif | clinicId=${clinicId}, search=${query.search || '-'}`);
    const qb = this.tarifRepository
      .createQueryBuilder('t')
      .where('t.clinicId = :clinicId AND t.isActive = true', { clinicId });

    if (query.search) {
      qb.andWhere('(t.name LIKE :s OR t.kodeIcd9 LIKE :s)', {
        s: `%${query.search}%`,
      });
    }
    if (query.kategori) {
      qb.andWhere('t.kategori = :kategori', { kategori: query.kategori });
    }

    qb.orderBy('t.kategori', 'ASC').addOrderBy('t.name', 'ASC');

    const page = query.page || 1;
    const limit = query.limit || 50;
    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  async findOne(id: number, clinicId: number): Promise<Tarif> {
    this.logger.log(`[GET] Mengambil detail tarif | id=${id}, clinicId=${clinicId}`);
    const tarif = await this.tarifRepository.findOne({
      where: { id, clinicId },
    });
    if (!tarif) {
      this.logger.warn(`[GET] Tarif tidak ditemukan | id=${id}, clinicId=${clinicId}`);
      throw new NotFoundException(`Tarif dengan ID ${id} tidak ditemukan`);
    }
    return tarif;
  }

  async create(
    clinicId: number,
    dto: CreateTarifDto,
    userId: number,
  ): Promise<Tarif> {
    this.logger.log(`[CREATE] Membuat tarif baru | clinicId=${clinicId}, name=${dto.name}`);
    const tarif = this.tarifRepository.create({
      clinicId,
      name: dto.name!,
      kategori: dto.kategori!,
      kodeIcd9: dto.kodeIcd9 ?? undefined,
      hargaPokok: dto.hargaPokok ?? 0,
      hargaJual: dto.hargaJual!,
      diskonMaksimal: dto.diskonMaksimal ?? 0,
      createdBy: userId,
    } as any);
    return this.tarifRepository.save(tarif) as unknown as Promise<Tarif>;
  }

  async update(
    id: number,
    clinicId: number,
    dto: UpdateTarifDto,
    userId: number,
  ): Promise<Tarif> {
    this.logger.log(`[UPDATE] Memperbarui tarif | id=${id}, clinicId=${clinicId}`);
    const tarif = await this.findOne(id, clinicId);
    Object.assign(tarif, {
      name: dto.name ?? tarif.name,
      kategori: dto.kategori ?? tarif.kategori,
      kodeIcd9: dto.kodeIcd9 ?? tarif.kodeIcd9,
      hargaPokok: dto.hargaPokok ?? tarif.hargaPokok,
      hargaJual: dto.hargaJual ?? tarif.hargaJual,
      diskonMaksimal: dto.diskonMaksimal ?? tarif.diskonMaksimal,
      isActive: dto.isActive ?? tarif.isActive,
      updatedBy: userId,
    });
    return this.tarifRepository.save(tarif);
  }
}
