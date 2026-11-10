import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { OperationalRecordsService } from '../operational-records.service';
import { OperationalRecord } from '../entities/operational-record.entity';

function buildQb(result: [any[], number] = [[], 0], rawRows: any[] = []) {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rawRows),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
  };
}

describe('OperationalRecordsService', () => {
  let service: OperationalRecordsService;
  let repo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperationalRecordsService,
        { provide: getRepositoryToken(OperationalRecord), useValue: repo },
      ],
    }).compile();

    service = module.get<OperationalRecordsService>(OperationalRecordsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('list', () => {
    it('scopes to clinic with default pagination (positive)', async () => {
      const qb = buildQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.list(1, {} as any);
      expect(qb.where).toHaveBeenCalledWith('o.clinicId = :clinicId', {
        clinicId: 1,
      });
      expect(qb.take).toHaveBeenCalledWith(50);
    });

    it('applies search/kategori/date filters (positive)', async () => {
      const qb = buildQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.list(1, {
        search: 'listrik',
        kategori: 'utilitas',
        startDate: '2026-01-01',
        endDate: '2026-01-31',
      } as any);
      expect(qb.andWhere).toHaveBeenCalledWith('o.deskripsi LIKE :search', {
        search: '%listrik%',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('o.kategori = :kategori', {
        kategori: 'utilitas',
      });
    });

    it('orders by date then id so paging is stable for same-day rows (positive)', async () => {
      const qb = buildQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.list(1, {} as any);
      expect(qb.orderBy).toHaveBeenCalledWith('o.tanggal', 'DESC');
      expect(qb.addOrderBy).toHaveBeenCalledWith('o.id', 'DESC');
    });

    it('returns period summary with per-category breakdown, biggest first (positive)', async () => {
      const qb = buildQb(
        [[], 3],
        [
          { kategori: 'listrik', total: '300000', count: '2' },
          { kategori: 'sewa', total: '2500000', count: '1' },
        ],
      );
      repo.createQueryBuilder.mockReturnValue(qb);

      const r: any = await service.list(1, { page: 1, limit: 2 } as any);

      expect(r.data.summary.total).toBe(2800000);
      expect(r.data.summary.count).toBe(3);
      expect(r.data.summary.byKategori.map((k: any) => k.kategori)).toEqual([
        'sewa',
        'listrik',
      ]);
      expect(r.data.summary.filteredTotal).toBe(2800000);
      expect(r.data.meta).toEqual({
        total: 3,
        page: 1,
        limit: 2,
        totalPages: 2,
      });
    });

    it('category filter narrows the list total but keeps the breakdown intact (edge)', async () => {
      const qb = buildQb(
        [[], 2],
        [
          { kategori: 'listrik', total: '300000', count: '2' },
          { kategori: 'sewa', total: '2500000', count: '1' },
        ],
      );
      repo.createQueryBuilder.mockReturnValue(qb);

      const r: any = await service.list(1, { kategori: 'listrik' } as any);

      expect(r.data.summary.filteredTotal).toBe(300000);
      expect(r.data.summary.total).toBe(2800000);
      expect(r.data.summary.byKategori).toHaveLength(2);
      // hanya query daftar yang disaring kategori; ringkasan memakai query terpisah
      const kategoriCalls = qb.andWhere.mock.calls.filter((c: any[]) =>
        String(c[0]).includes('o.kategori = :kategori'),
      );
      expect(kategoriCalls).toHaveLength(1);
    });

    it('returns an empty summary when there are no records (edge)', async () => {
      const r: any = await service.list(1, {} as any);
      expect(r.data.summary).toEqual({
        total: 0,
        count: 0,
        byKategori: [],
        filteredTotal: 0,
      });
      expect(r.data.meta.totalPages).toBe(0);
    });
  });

  describe('findOne', () => {
    it('returns the record when found (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      const result = await service.findOne(1, 1);
      expect(result.data).toEqual({ id: 1 });
    });

    it('throws NotFoundException when missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a record scoped to the clinic (positive)', async () => {
      const result = await service.create(
        { deskripsi: 'Bayar listrik' } as any,
        1,
        9,
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ clinicId: 1, createdBy: 9, updatedBy: 9 }),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('update', () => {
    it('merges fields into the existing record (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, clinicId: 1, deskripsi: 'Old' });
      const result = await service.update(1, { deskripsi: 'New' } as any, 1, 9);
      expect(result.data.deskripsi).toBe('New');
    });

    it('throws NotFoundException when missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update(999, {} as any, 1, 9)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('removes the record when found (positive)', async () => {
      const record = { id: 1, clinicId: 1 };
      repo.findOne.mockResolvedValue(record);
      await service.remove(1, 1);
      expect(repo.remove).toHaveBeenCalledWith(record);
    });

    it('throws NotFoundException when missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999, 1)).rejects.toThrow(NotFoundException);
    });
  });
});
