import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Barang } from './entities/barang.entity';
import {
  StokTransaksi,
  StokTransaksiType,
} from './entities/stok-transaksi.entity';
import { TindakanBom } from './entities/tindakan-bom.entity';
import {
  BarangQueryDto,
  CreateBarangDto,
  UpdateBarangDto,
} from './dto/barang.dto';
import {
  CreateStokTransaksiDto,
  StokTransaksiQueryDto,
} from './dto/stok-transaksi.dto';
import { CreateTindakanBomDto, UpdateTindakanBomDto } from './dto/tindakan-bom.dto';

@Injectable()
export class GudangService {
  private readonly logger = new Logger(GudangService.name);

  constructor(
    @InjectRepository(Barang)
    private readonly barangRepository: Repository<Barang>,
    @InjectRepository(StokTransaksi)
    private readonly stokTransaksiRepository: Repository<StokTransaksi>,
    @InjectRepository(TindakanBom)
    private readonly tindakanBomRepository: Repository<TindakanBom>,
    private readonly dataSource: DataSource,
  ) {}

  // ── Barang ──────────────────────────────────────────────────────────────

  async findAllBarang(clinicId: number, query: BarangQueryDto) {
    const qb = this.barangRepository
      .createQueryBuilder('b')
      .where('b.clinicId = :clinicId', { clinicId });

    if (query.search) {
      qb.andWhere('(b.name LIKE :s OR b.sku LIKE :s)', {
        s: `%${query.search}%`,
      });
    }
    if (query.kategori) {
      qb.andWhere('b.kategori = :kategori', { kategori: query.kategori });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('b.isActive = :isActive', { isActive: query.isActive });
    }
    if (query.lowStock) {
      qb.andWhere('b.stokSaatIni < b.stokMinimum');
    }

    qb.orderBy('b.name', 'ASC');

    const page = query.page || 1;
    const limit = query.limit || 50;
    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  async findOneBarang(id: number, clinicId: number): Promise<Barang> {
    const barang = await this.barangRepository.findOne({
      where: { id, clinicId },
    });
    if (!barang) {
      throw new NotFoundException(`Barang dengan ID ${id} tidak ditemukan`);
    }
    return barang;
  }

  async createBarang(
    clinicId: number,
    dto: CreateBarangDto,
    userId: number,
  ): Promise<Barang> {
    const existing = await this.barangRepository.findOne({
      where: { clinicId, sku: dto.sku },
    });
    if (existing) {
      throw new BadRequestException(`SKU '${dto.sku}' sudah digunakan`);
    }
    const barang = this.barangRepository.create({
      clinicId,
      name: dto.name,
      sku: dto.sku,
      kategori: dto.kategori,
      satuanBeli: dto.satuanBeli,
      satuanPakai: dto.satuanPakai,
      konversiQty: dto.konversiQty ?? 1,
      supplierName: dto.supplierName,
      hargaBeli: dto.hargaBeli ?? 0,
      stokMinimum: dto.stokMinimum ?? 0,
      trackExpiry: dto.trackExpiry ?? false,
      lokasiSimpan: dto.lokasiSimpan,
      createdBy: userId,
    } as any);
    return this.barangRepository.save(barang) as unknown as Promise<Barang>;
  }

  async updateBarang(
    id: number,
    clinicId: number,
    dto: UpdateBarangDto,
    userId: number,
  ): Promise<Barang> {
    const barang = await this.findOneBarang(id, clinicId);
    if (dto.sku && dto.sku !== barang.sku) {
      const existing = await this.barangRepository.findOne({
        where: { clinicId, sku: dto.sku },
      });
      if (existing) {
        throw new BadRequestException(`SKU '${dto.sku}' sudah digunakan`);
      }
    }
    Object.assign(barang, {
      name: dto.name ?? barang.name,
      sku: dto.sku ?? barang.sku,
      kategori: dto.kategori ?? barang.kategori,
      satuanBeli: dto.satuanBeli ?? barang.satuanBeli,
      satuanPakai: dto.satuanPakai ?? barang.satuanPakai,
      konversiQty: dto.konversiQty ?? barang.konversiQty,
      supplierName: dto.supplierName ?? barang.supplierName,
      hargaBeli: dto.hargaBeli ?? barang.hargaBeli,
      stokMinimum: dto.stokMinimum ?? barang.stokMinimum,
      trackExpiry: dto.trackExpiry ?? barang.trackExpiry,
      lokasiSimpan: dto.lokasiSimpan ?? barang.lokasiSimpan,
      isActive: dto.isActive ?? barang.isActive,
      updatedBy: userId,
    });
    return this.barangRepository.save(barang);
  }

  async removeBarang(id: number, clinicId: number, userId: number): Promise<void> {
    const barang = await this.findOneBarang(id, clinicId);
    barang.isActive = false;
    barang.updatedBy = userId;
    await this.barangRepository.save(barang);
  }

  // ── Stok Transaksi ──────────────────────────────────────────────────────

  async findAllTransaksi(clinicId: number, query: StokTransaksiQueryDto) {
    const qb = this.stokTransaksiRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.barang', 'barang')
      .where('t.clinicId = :clinicId', { clinicId });

    if (query.barangId) {
      qb.andWhere('t.barangId = :barangId', { barangId: query.barangId });
    }
    if (query.type) {
      qb.andWhere('t.type = :type', { type: query.type });
    }
    if (query.startDate) {
      qb.andWhere('t.tanggal >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      qb.andWhere('t.tanggal <= :endDate', { endDate: query.endDate });
    }

    qb.orderBy('t.tanggal', 'DESC').addOrderBy('t.id', 'DESC');

    const page = query.page || 1;
    const limit = query.limit || 50;
    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  async createTransaksi(
    clinicId: number,
    dto: CreateStokTransaksiDto,
    userId: number,
  ): Promise<StokTransaksi> {
    return this.dataSource.transaction(async (manager) => {
      const barang = await manager.findOne(Barang, {
        where: { id: dto.barangId, clinicId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!barang) {
        throw new NotFoundException(
          `Barang dengan ID ${dto.barangId} tidak ditemukan`,
        );
      }

      let delta: number;
      switch (dto.type) {
        case StokTransaksiType.IN:
          delta = dto.qty;
          break;
        case StokTransaksiType.OUT:
        case StokTransaksiType.EXPIRED:
          delta = -Math.abs(dto.qty);
          break;
        case StokTransaksiType.ADJUSTMENT:
          delta = dto.qty;
          break;
        default:
          throw new BadRequestException('Tipe transaksi tidak valid');
      }

      const newStok = barang.stokSaatIni + delta;
      if (newStok < 0) {
        throw new BadRequestException(
          `Stok tidak mencukupi. Stok saat ini: ${barang.stokSaatIni}, diminta: ${Math.abs(delta)}`,
        );
      }

      barang.stokSaatIni = newStok;
      barang.updatedBy = userId;
      if (dto.type === StokTransaksiType.IN && dto.hargaBeli) {
        barang.hargaBeli = dto.hargaBeli;
      }
      await manager.save(Barang, barang);

      const transaksi = manager.create(StokTransaksi, {
        clinicId,
        barangId: dto.barangId,
        type: dto.type,
        qty: dto.qty,
        hargaBeli: dto.hargaBeli,
        noFaktur: dto.noFaktur,
        noBatch: dto.noBatch,
        tanggalExpiry: dto.tanggalExpiry,
        alasan: dto.alasan,
        tanggal: dto.tanggal,
        createdByUserId: userId,
        createdBy: userId,
      });
      return manager.save(StokTransaksi, transaksi);
    });
  }

  // ── Dashboard ───────────────────────────────────────────────────────────

  async getDashboard(clinicId: number) {
    const activeBarang = await this.barangRepository.find({
      where: { clinicId, isActive: true },
    });

    const totalItems = activeBarang.length;
    const lowStockItems = activeBarang.filter(
      (b) => b.stokSaatIni < b.stokMinimum,
    );
    const totalInventoryValue = activeBarang.reduce(
      (sum, b) => sum + b.stokSaatIni * Number(b.hargaBeli || 0),
      0,
    );

    const trackedIds = activeBarang
      .filter((b) => b.trackExpiry)
      .map((b) => b.id);

    let nearExpiryCount = 0;
    if (trackedIds.length > 0) {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const today = new Date().toISOString().slice(0, 10);
      const nearExpiryRows = await this.stokTransaksiRepository
        .createQueryBuilder('t')
        .select('t.barangId', 'barangId')
        .where('t.clinicId = :clinicId', { clinicId })
        .andWhere('t.barangId IN (:...ids)', { ids: trackedIds })
        .andWhere('t.tanggalExpiry IS NOT NULL')
        .andWhere('t.tanggalExpiry >= :today', { today })
        .andWhere('t.tanggalExpiry <= :limit', {
          limit: thirtyDaysFromNow.toISOString().slice(0, 10),
        })
        .groupBy('t.barangId')
        .getRawMany();
      nearExpiryCount = nearExpiryRows.length;
    }

    return {
      totalItems,
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.map((b) => ({
        id: b.id,
        name: b.name,
        sku: b.sku,
        stokSaatIni: b.stokSaatIni,
        stokMinimum: b.stokMinimum,
      })),
      totalInventoryValue,
      nearExpiryCount,
    };
  }

  // ── BOM (Resep Bahan per Tindakan) ─────────────────────────────────────

  async findBomByTarif(clinicId: number, tarifId: number): Promise<TindakanBom[]> {
    return this.tindakanBomRepository.find({
      where: { clinicId, tarifId },
      relations: { barang: true },
      order: { id: 'ASC' },
    });
  }

  async createBom(
    clinicId: number,
    dto: CreateTindakanBomDto,
    userId: number,
  ): Promise<TindakanBom> {
    const barang = await this.barangRepository.findOne({
      where: { id: dto.barangId, clinicId },
    });
    if (!barang) {
      throw new NotFoundException(`Barang dengan ID ${dto.barangId} tidak ditemukan`);
    }
    const existing = await this.tindakanBomRepository.findOne({
      where: { clinicId, tarifId: dto.tarifId, barangId: dto.barangId },
    });
    if (existing) {
      throw new BadRequestException('Barang ini sudah terdaftar di resep tindakan ini');
    }
    const bom = this.tindakanBomRepository.create({
      clinicId,
      tarifId: dto.tarifId,
      barangId: dto.barangId,
      qtyPakai: dto.qtyPakai,
      wajib: dto.wajib ?? true,
      createdBy: userId,
    } as any);
    return this.tindakanBomRepository.save(bom) as unknown as Promise<TindakanBom>;
  }

  async updateBom(
    id: number,
    clinicId: number,
    dto: UpdateTindakanBomDto,
    userId: number,
  ): Promise<TindakanBom> {
    const bom = await this.tindakanBomRepository.findOne({ where: { id, clinicId } });
    if (!bom) {
      throw new NotFoundException(`Resep bahan dengan ID ${id} tidak ditemukan`);
    }
    Object.assign(bom, {
      qtyPakai: dto.qtyPakai ?? bom.qtyPakai,
      wajib: dto.wajib ?? bom.wajib,
      updatedBy: userId,
    });
    return this.tindakanBomRepository.save(bom);
  }

  async removeBom(id: number, clinicId: number): Promise<void> {
    const bom = await this.tindakanBomRepository.findOne({ where: { id, clinicId } });
    if (!bom) {
      throw new NotFoundException(`Resep bahan dengan ID ${id} tidak ditemukan`);
    }
    await this.tindakanBomRepository.remove(bom);
  }

  /**
   * Auto-deduct stok berdasarkan BOM (hanya komponen wajib) saat tindakan dipilih.
   * Dipanggil dari dalam transaksi billing (create). Barang dengan stok tidak cukup
   * dilewati dengan warning log, tidak menggagalkan pembuatan billing — gudang bukan
   * syarat mutlak transaksi kasir.
   */
  async deductForTindakan(
    manager: EntityManager,
    clinicId: number,
    tarifId: number,
    tindakanQty: number,
    userId: number,
  ): Promise<void> {
    const bomRows = await manager.find(TindakanBom, {
      where: { clinicId, tarifId, wajib: true },
    });
    for (const bom of bomRows) {
      const totalQty = Math.round(Number(bom.qtyPakai) * tindakanQty);
      if (totalQty <= 0) continue;
      const barang = await manager.findOne(Barang, {
        where: { id: bom.barangId, clinicId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!barang || !barang.isActive) continue;
      if (barang.stokSaatIni < totalQty) {
        this.logger.warn(
          `[BOM-DEDUCT] Stok tidak cukup untuk barang ${barang.id} (${barang.name}), butuh ${totalQty}, tersedia ${barang.stokSaatIni} — dilewati`,
        );
        continue;
      }
      barang.stokSaatIni -= totalQty;
      barang.updatedBy = userId;
      await manager.save(Barang, barang);
      await manager.save(StokTransaksi, {
        clinicId,
        barangId: barang.id,
        type: StokTransaksiType.OUT,
        qty: totalQty,
        alasan: `Pemakaian otomatis tindakan (tarifId=${tarifId})`,
        tanggal: new Date().toISOString().slice(0, 10),
        createdByUserId: userId,
        createdBy: userId,
      });
    }
  }

  /**
   * Kebalikan dari deductForTindakan — dipanggil saat billing dibatalkan.
   * Mengasumsikan BOM tidak berubah sejak deduksi awal.
   */
  async restoreForTindakan(
    manager: EntityManager,
    clinicId: number,
    tarifId: number,
    tindakanQty: number,
    userId: number,
  ): Promise<void> {
    const bomRows = await manager.find(TindakanBom, {
      where: { clinicId, tarifId, wajib: true },
    });
    for (const bom of bomRows) {
      const totalQty = Math.round(Number(bom.qtyPakai) * tindakanQty);
      if (totalQty <= 0) continue;
      const barang = await manager.findOne(Barang, {
        where: { id: bom.barangId, clinicId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!barang) continue;
      barang.stokSaatIni += totalQty;
      barang.updatedBy = userId;
      await manager.save(Barang, barang);
      await manager.save(StokTransaksi, {
        clinicId,
        barangId: barang.id,
        type: StokTransaksiType.IN,
        qty: totalQty,
        alasan: `Pengembalian otomatis — tindakan dibatalkan (tarifId=${tarifId})`,
        tanggal: new Date().toISOString().slice(0, 10),
        createdByUserId: userId,
        createdBy: userId,
      });
    }
  }
}
