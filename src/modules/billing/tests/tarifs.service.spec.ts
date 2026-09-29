import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { TarifsService } from '../tarifs.service';
import { Tarif } from '../../tarif/entities/tarif.entity';

function buildQb() {
  return {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
}

describe('TarifsService', () => {
  let service: TarifsService;
  let repo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let qb: ReturnType<typeof buildQb>;

  beforeEach(async () => {
    qb = buildQb();
    repo = {
      createQueryBuilder: jest.fn(() => qb),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TarifsService,
        { provide: getRepositoryToken(Tarif), useValue: repo },
      ],
    }).compile();

    service = module.get<TarifsService>(TarifsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findAll', () => {
    it('scopes list to clinicId and applies default pagination (positive)', async () => {
      await service.findAll(1, {} as any);
      expect(qb.where).toHaveBeenCalledWith(
        't.clinicId = :clinicId AND t.isActive = true',
        { clinicId: 1 },
      );
      expect(qb.skip).toHaveBeenCalledWith(0);
      expect(qb.take).toHaveBeenCalledWith(50);
    });

    it('applies search and kategori filters when provided (positive)', async () => {
      await service.findAll(1, { search: 'gigi', kategori: 'umum' } as any);
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(t.name LIKE :s OR t.kodeIcd9 LIKE :s)',
        { s: '%gigi%' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('t.kategori = :kategori', {
        kategori: 'umum',
      });
    });

    it('applies custom page/limit (edge)', async () => {
      await service.findAll(1, { page: 3, limit: 5 } as any);
      expect(qb.skip).toHaveBeenCalledWith(10);
      expect(qb.take).toHaveBeenCalledWith(5);
    });
  });

  describe('findOne', () => {
    it('returns the tarif when found within clinic (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      const result = await service.findOne(1, 1);
      expect(result).toEqual({ id: 1, clinicId: 1 });
    });

    it('throws NotFoundException when not found (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('does not leak a tarif belonging to another clinic (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await service.findOne(1, 2).catch(() => undefined);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1, clinicId: 2 },
      });
    });
  });

  describe('create', () => {
    it('defaults hargaPokok/diskonMaksimal to 0 when omitted (positive)', async () => {
      const dto = { name: 'Cabut gigi', kategori: 'umum', hargaJual: 100000 };
      await service.create(1, dto as any, 7);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hargaPokok: 0,
          diskonMaksimal: 0,
          createdBy: 7,
        }),
      );
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('merges only provided fields, keeping existing values (positive)', async () => {
      repo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        name: 'Old',
        hargaJual: 50000,
        isActive: true,
      });

      await service.update(1, 1, { hargaJual: 75000 } as any, 9);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Old', hargaJual: 75000, updatedBy: 9 }),
      );
    });

    it('throws NotFoundException when target tarif is missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.update(999, 1, {} as any, 9),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting isActive=false (positive)', async () => {
      const tarif = { id: 1, clinicId: 1, isActive: true };
      repo.findOne.mockResolvedValue(tarif);

      await service.remove(1, 1, 3);

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false, updatedBy: 3 }),
      );
    });

    it('throws NotFoundException when target tarif is missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999, 1, 3)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
