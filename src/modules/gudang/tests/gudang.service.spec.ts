import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GudangService } from '../gudang.service';
import { Barang } from '../entities/barang.entity';
import { StokTransaksi, StokTransaksiType } from '../entities/stok-transaksi.entity';
import { TindakanBom } from '../entities/tindakan-bom.entity';

function buildQb(result: [any[], number] = [[], 0]) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
}

describe('GudangService', () => {
  let service: GudangService;
  let barangRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let stokRepo: { createQueryBuilder: jest.Mock };
  let bomRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let manager: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; find: jest.Mock };

  const clinicId = 1;
  const userId = 9;

  beforeEach(async () => {
    manager = {
      findOne: jest.fn(),
      save: jest.fn((entityOrData: any, data?: any) =>
        Promise.resolve(data !== undefined ? { id: 1, ...data } : entityOrData),
      ),
      create: jest.fn((entity: any, data: any) => data),
      find: jest.fn(),
    };
    barangRepo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };
    stokRepo = { createQueryBuilder: jest.fn(() => buildQb()) };
    bomRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = { transaction: jest.fn((cb: any) => cb(manager)) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GudangService,
        { provide: getRepositoryToken(Barang), useValue: barangRepo },
        { provide: getRepositoryToken(StokTransaksi), useValue: stokRepo },
        { provide: getRepositoryToken(TindakanBom), useValue: bomRepo },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = module.get<GudangService>(GudangService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('Barang CRUD', () => {
    it('lists barang scoped to clinic with default pagination (positive)', async () => {
      const qb = buildQb();
      barangRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAllBarang(clinicId, {} as any);
      expect(qb.where).toHaveBeenCalledWith('b.clinicId = :clinicId', {
        clinicId,
      });
      expect(qb.take).toHaveBeenCalledWith(50);
    });

    it('applies the lowStock filter (positive)', async () => {
      const qb = buildQb();
      barangRepo.createQueryBuilder.mockReturnValue(qb);
      await service.findAllBarang(clinicId, { lowStock: true } as any);
      expect(qb.andWhere).toHaveBeenCalledWith(
        'b.stokSaatIni < b.stokMinimum',
      );
    });

    it('throws NotFoundException for a missing barang (negative)', async () => {
      barangRepo.findOne.mockResolvedValue(null);
      await expect(service.findOneBarang(999, clinicId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('creates barang with sane defaults (positive)', async () => {
      barangRepo.findOne.mockResolvedValue(null);
      await service.createBarang(
        clinicId,
        { name: 'Kapas', sku: 'SKU1', satuanBeli: 'box', satuanPakai: 'pcs' } as any,
        userId,
      );
      expect(barangRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ konversiQty: 1, hargaBeli: 0, stokMinimum: 0, trackExpiry: false }),
      );
    });

    it('throws BadRequestException for a duplicate SKU on create (negative)', async () => {
      barangRepo.findOne.mockResolvedValue({ id: 1, sku: 'SKU1' });
      await expect(
        service.createBarang(clinicId, { sku: 'SKU1' } as any, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates barang, only re-checking SKU uniqueness when it changes (positive)', async () => {
      barangRepo.findOne
        .mockResolvedValueOnce({ id: 1, clinicId, sku: 'OLD', name: 'A' }) // findOneBarang
        ; // no further findOne call expected since sku unchanged
      const result = await service.updateBarang(
        1,
        clinicId,
        { name: 'B' } as any,
        userId,
      );
      expect(result.name).toBe('B');
      expect(barangRepo.findOne).toHaveBeenCalledTimes(1);
    });

    it('throws BadRequestException when updating to an SKU already used by another barang (negative)', async () => {
      barangRepo.findOne
        .mockResolvedValueOnce({ id: 1, clinicId, sku: 'OLD' })
        .mockResolvedValueOnce({ id: 2, sku: 'NEW' });
      await expect(
        service.updateBarang(1, clinicId, { sku: 'NEW' } as any, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('soft-deletes barang via isActive=false (positive)', async () => {
      barangRepo.findOne.mockResolvedValue({ id: 1, clinicId, isActive: true });
      await service.removeBarang(1, clinicId, userId);
      expect(barangRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, updatedBy: userId }),
      );
    });
  });

  describe('createTransaksi', () => {
    const barang = { id: 1, clinicId, stokSaatIni: 10, hargaBeli: 5000 };

    it('increases stock for an IN transaction (positive)', async () => {
      manager.findOne.mockResolvedValue({ ...barang });
      await service.createTransaksi(
        clinicId,
        { barangId: 1, type: StokTransaksiType.IN, qty: 5 } as any,
        userId,
      );
      const savedBarang = manager.save.mock.calls.find(
        (c: any[]) => c[0] === Barang,
      )[1];
      expect(savedBarang.stokSaatIni).toBe(15);
    });

    it('decreases stock for an OUT transaction (positive)', async () => {
      manager.findOne.mockResolvedValue({ ...barang });
      await service.createTransaksi(
        clinicId,
        { barangId: 1, type: StokTransaksiType.OUT, qty: 4 } as any,
        userId,
      );
      const savedBarang = manager.save.mock.calls.find(
        (c: any[]) => c[0] === Barang,
      )[1];
      expect(savedBarang.stokSaatIni).toBe(6);
    });

    it('decreases stock for an EXPIRED transaction regardless of qty sign (positive/edge)', async () => {
      manager.findOne.mockResolvedValue({ ...barang });
      await service.createTransaksi(
        clinicId,
        { barangId: 1, type: StokTransaksiType.EXPIRED, qty: -3 } as any,
        userId,
      );
      const savedBarang = manager.save.mock.calls.find(
        (c: any[]) => c[0] === Barang,
      )[1];
      expect(savedBarang.stokSaatIni).toBe(7);
    });

    it('applies ADJUSTMENT delta directly, including negative (positive/edge)', async () => {
      manager.findOne.mockResolvedValue({ ...barang });
      await service.createTransaksi(
        clinicId,
        { barangId: 1, type: StokTransaksiType.ADJUSTMENT, qty: -2 } as any,
        userId,
      );
      const savedBarang = manager.save.mock.calls.find(
        (c: any[]) => c[0] === Barang,
      )[1];
      expect(savedBarang.stokSaatIni).toBe(8);
    });

    it('throws BadRequestException when OUT would drop stock below zero (negative)', async () => {
      manager.findOne.mockResolvedValue({ ...barang, stokSaatIni: 2 });
      await expect(
        service.createTransaksi(
          clinicId,
          { barangId: 1, type: StokTransaksiType.OUT, qty: 5 } as any,
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when barang does not exist (negative)', async () => {
      manager.findOne.mockResolvedValue(null);
      await expect(
        service.createTransaksi(
          clinicId,
          { barangId: 999, type: StokTransaksiType.IN, qty: 1 } as any,
          userId,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for an unrecognized transaction type (negative)', async () => {
      manager.findOne.mockResolvedValue({ ...barang });
      await expect(
        service.createTransaksi(
          clinicId,
          { barangId: 1, type: 'invalid' as any, qty: 1 } as any,
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates hargaBeli only for an IN transaction that provides it (positive/edge)', async () => {
      manager.findOne.mockResolvedValue({ ...barang, hargaBeli: 1000 });
      await service.createTransaksi(
        clinicId,
        { barangId: 1, type: StokTransaksiType.IN, qty: 1, hargaBeli: 2000 } as any,
        userId,
      );
      const savedBarang = manager.save.mock.calls.find(
        (c: any[]) => c[0] === Barang,
      )[1];
      expect(savedBarang.hargaBeli).toBe(2000);
    });
  });

  describe('getDashboard', () => {
    it('summarizes total items, low stock and inventory value (positive)', async () => {
      barangRepo.find.mockResolvedValue([
        { id: 1, stokSaatIni: 2, stokMinimum: 5, hargaBeli: 1000, trackExpiry: false, name: 'A', sku: 'A1' },
        { id: 2, stokSaatIni: 20, stokMinimum: 5, hargaBeli: 2000, trackExpiry: false, name: 'B', sku: 'B1' },
      ]);

      const result = await service.getDashboard(clinicId);

      expect(result.totalItems).toBe(2);
      expect(result.lowStockCount).toBe(1);
      expect(result.totalInventoryValue).toBe(2 * 1000 + 20 * 2000);
      expect(result.nearExpiryCount).toBe(0);
    });

    it('skips the near-expiry query entirely when nothing tracks expiry (edge)', async () => {
      barangRepo.find.mockResolvedValue([
        { id: 1, stokSaatIni: 10, stokMinimum: 5, hargaBeli: 1000, trackExpiry: false },
      ]);
      await service.getDashboard(clinicId);
      expect(stokRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('counts near-expiry items when tracked barang exist (positive)', async () => {
      barangRepo.find.mockResolvedValue([
        { id: 1, stokSaatIni: 10, stokMinimum: 5, hargaBeli: 1000, trackExpiry: true },
      ]);
      const qb = buildQb();
      qb.getRawMany.mockResolvedValue([{ barangId: 1 }]);
      stokRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getDashboard(clinicId);
      expect(result.nearExpiryCount).toBe(1);
    });
  });

  describe('BOM', () => {
    it('creates a BOM entry when barang exists and is not yet linked (positive)', async () => {
      barangRepo.findOne.mockResolvedValue({ id: 1, clinicId });
      bomRepo.findOne.mockResolvedValue(null);
      await service.createBom(
        clinicId,
        { tarifId: 5, barangId: 1, qtyPakai: 2 } as any,
        userId,
      );
      expect(bomRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ wajib: true }),
      );
    });

    it('throws NotFoundException when the barang does not exist (negative)', async () => {
      barangRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createBom(clinicId, { tarifId: 5, barangId: 999 } as any, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the barang is already linked to this tarif (negative)', async () => {
      barangRepo.findOne.mockResolvedValue({ id: 1, clinicId });
      bomRepo.findOne.mockResolvedValue({ id: 2 });
      await expect(
        service.createBom(clinicId, { tarifId: 5, barangId: 1 } as any, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when updating a non-existent BOM (negative)', async () => {
      bomRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateBom(999, clinicId, {} as any, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when removing a non-existent BOM (negative)', async () => {
      bomRepo.findOne.mockResolvedValue(null);
      await expect(service.removeBom(999, clinicId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deductForTindakan / restoreForTindakan', () => {
    it('deducts stock proportional to tindakan quantity for wajib BOM rows (positive)', async () => {
      manager.find.mockResolvedValue([{ barangId: 1, qtyPakai: 2 }]);
      manager.findOne.mockResolvedValue({
        id: 1,
        isActive: true,
        stokSaatIni: 10,
        name: 'Kapas',
      });

      await service.deductForTindakan(manager as any, clinicId, 5, 3, userId);

      const savedBarang = manager.save.mock.calls.find(
        (c: any[]) => c[0] === Barang,
      )[1];
      expect(savedBarang.stokSaatIni).toBe(4); // 10 - (2*3)
    });

    it('skips deduction (without throwing) when stock is insufficient (negative/edge)', async () => {
      manager.find.mockResolvedValue([{ barangId: 1, qtyPakai: 2 }]);
      manager.findOne.mockResolvedValue({
        id: 1,
        isActive: true,
        stokSaatIni: 1,
        name: 'Kapas',
      });

      await expect(
        service.deductForTindakan(manager as any, clinicId, 5, 3, userId),
      ).resolves.toBeUndefined();
      const barangSaveCalls = manager.save.mock.calls.filter(
        (c: any[]) => c[0] === Barang,
      );
      expect(barangSaveCalls).toHaveLength(0);
    });

    it('skips an inactive barang instead of deducting (negative/edge)', async () => {
      manager.find.mockResolvedValue([{ barangId: 1, qtyPakai: 2 }]);
      manager.findOne.mockResolvedValue({
        id: 1,
        isActive: false,
        stokSaatIni: 100,
      });

      await service.deductForTindakan(manager as any, clinicId, 5, 3, userId);
      const barangSaveCalls = manager.save.mock.calls.filter(
        (c: any[]) => c[0] === Barang,
      );
      expect(barangSaveCalls).toHaveLength(0);
    });

    it('restores stock symmetrically to a prior deduction (positive)', async () => {
      manager.find.mockResolvedValue([{ barangId: 1, qtyPakai: 2 }]);
      manager.findOne.mockResolvedValue({
        id: 1,
        stokSaatIni: 4,
      });

      await service.restoreForTindakan(manager as any, clinicId, 5, 3, userId);

      const savedBarang = manager.save.mock.calls.find(
        (c: any[]) => c[0] === Barang,
      )[1];
      expect(savedBarang.stokSaatIni).toBe(10); // 4 + (2*3)
    });
  });
});
