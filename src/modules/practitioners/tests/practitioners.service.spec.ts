import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PractitionersService } from '../practitioners.service';
import { Practitioner } from '../entities/practitioner.entity';

describe('PractitionersService', () => {
  let service: PractitionersService;
  let repo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PractitionersService,
        { provide: getRepositoryToken(Practitioner), useValue: repo },
      ],
    }).compile();

    service = module.get<PractitionersService>(PractitionersService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findAll', () => {
    it('lists practitioners scoped to clinic (positive)', async () => {
      repo.find.mockResolvedValue([{ id: 1 }]);
      const result = await service.findAll(1);
      expect(result.data).toHaveLength(1);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clinicId: 1 } }),
      );
    });
  });

  describe('findOne', () => {
    it('returns the practitioner when found (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      const result = await service.findOne(1, 1);
      expect(result.data).toEqual({ id: 1 });
    });

    it('throws NotFoundException when missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('registers a new practitioner (positive)', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.create(
        { nik: '123', name: 'Dr. A' } as any,
        1,
        9,
      );
      expect(result.data.nik).toBe('123');
    });

    it('throws ConflictException for a duplicate NIK within the clinic (negative)', async () => {
      repo.findOne.mockResolvedValue({ id: 2, nik: '123' });
      await expect(
        service.create({ nik: '123' } as any, 1, 9),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('merges dto fields into the practitioner (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, clinicId: 1, name: 'Old' });
      const result = await service.update(1, { name: 'New' } as any, 1, 9);
      expect(result.data.name).toBe('New');
    });

    it('throws NotFoundException when missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.update(999, {} as any, 1, 9),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes the practitioner when found (positive)', async () => {
      const p = { id: 1, clinicId: 1 };
      repo.findOne.mockResolvedValue(p);
      await service.remove(1, 1);
      expect(repo.remove).toHaveBeenCalledWith(p);
    });

    it('throws NotFoundException when missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('searchSatusehat', () => {
    it('echoes back the queried NIK in the mock response (positive)', async () => {
      const result = await service.searchSatusehat(
        { nik: '9999999999999999' } as any,
        1,
      );
      expect(result.data.nik).toBe('9999999999999999');
      expect(result.data.found).toBe(true);
    });
  });
});
