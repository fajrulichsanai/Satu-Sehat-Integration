import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Barang } from './entities/barang.entity';
import {
  StokTransaksi,
  StokTransaksiType,
} from './entities/stok-transaksi.entity';
import { StockOpname, StockOpnameItem } from './entities/stock-opname.entity';
import { CreateStockOpnameDto } from './dto/stock-opname.dto';
import { User } from '../users/entities/user.entity';

/**
 * Stock opname BMHP: catat jumlah fisik, sistem membuat transaksi
 * penyesuaian (adjustment) sebesar selisihnya dan menyimpan berita acara.
 */
@Injectable()
export class StockOpnameService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(StockOpname)
    private readonly opnameRepo: Repository<StockOpname>,
    @InjectRepository(StockOpnameItem)
    private readonly itemRepo: Repository<StockOpnameItem>,
  ) {}

  async create(clinicId: number, dto: CreateStockOpnameDto, userId: number) {
    const ids = dto.items.map((i) => i.barangId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Barang yang sama tercatat dua kali');
    }
    const opnameId = await this.dataSource.transaction(async (m) => {
      const barangList = await m.find(Barang, {
        where: { clinicId, id: In(ids) },
        lock: { mode: 'pessimistic_write' },
      });
      if (barangList.length !== ids.length) {
        throw new NotFoundException(
          'Ada barang yang tidak ditemukan di klinik ini',
        );
      }
      const byId = new Map(barangList.map((b) => [b.id, b]));
      const user = await m.findOne(User, { where: { id: userId } });
      const opname = await m.save(
        m.create(StockOpname, {
          clinicId,
          tanggal: dto.tanggal,
          note: dto.note?.trim() || null,
          createdBy: userId,
          createdByName: user?.name ?? null,
          totalSelisihNilai: 0,
        }),
      );
      let total = 0;
      for (const it of dto.items) {
        const b = byId.get(it.barangId)!;
        const selisih = it.stokFisik - b.stokSaatIni;
        const harga = Number(b.hargaBeli || 0);
        total += selisih * harga;
        await m.save(
          m.create(StockOpnameItem, {
            opnameId: opname.id,
            barangId: b.id,
            name: b.name,
            stokSistem: b.stokSaatIni,
            stokFisik: it.stokFisik,
            selisih,
            hargaBeli: harga,
            catatan: it.catatan?.trim() || null,
          }),
        );
        if (selisih !== 0) {
          await m.save(
            m.create(StokTransaksi, {
              clinicId,
              barangId: b.id,
              type: StokTransaksiType.ADJUSTMENT,
              qty: selisih,
              alasan:
                `Stock opname #${opname.id}${it.catatan ? ` — ${it.catatan.trim()}` : ''}`.slice(
                  0,
                  255,
                ),
              tanggal: dto.tanggal,
              createdByUserId: userId,
              createdBy: userId,
            }),
          );
          b.stokSaatIni = it.stokFisik;
          b.updatedBy = userId;
          await m.save(Barang, b);
        }
      }
      await m.update(StockOpname, opname.id, {
        totalSelisihNilai: Math.round(total),
      });
      return opname.id;
    });
    return this.findOne(clinicId, opnameId);
  }

  async list(clinicId: number) {
    const rows: any[] = await this.opnameRepo.query(
      `SELECT o.id, DATE_FORMAT(o.tanggal, '%Y-%m-%d') AS tanggal, o.note,
         o.total_selisih_nilai AS totalSelisihNilai, o.created_by_name AS createdByName,
         o.created_at AS createdAt,
         COUNT(i.id) AS itemCount,
         SUM(CASE WHEN i.selisih <> 0 THEN 1 ELSE 0 END) AS selisihCount
       FROM stock_opnames o
       LEFT JOIN stock_opname_items i ON i.opname_id = o.id
       WHERE o.clinic_id = ?
       GROUP BY o.id
       ORDER BY o.tanggal DESC, o.id DESC
       LIMIT 200`,
      [clinicId],
    );
    return rows.map((r) => ({
      id: Number(r.id),
      tanggal: r.tanggal,
      note: r.note,
      totalSelisihNilai: Number(r.totalSelisihNilai || 0),
      createdByName: r.createdByName,
      createdAt: r.createdAt,
      itemCount: Number(r.itemCount || 0),
      selisihCount: Number(r.selisihCount || 0),
    }));
  }

  async findOne(clinicId: number, id: number) {
    const opname = await this.opnameRepo.findOne({ where: { id, clinicId } });
    if (!opname) throw new NotFoundException('Stock opname tidak ditemukan');
    const items = await this.itemRepo.find({
      where: { opnameId: id },
      order: { name: 'ASC' },
    });
    return { ...opname, items };
  }
}
