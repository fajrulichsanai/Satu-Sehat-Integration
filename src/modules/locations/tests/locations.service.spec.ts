import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LocationsService } from '../locations.service';
import { Location } from '../../location/entities/location.entity';

describe('LocationsService', () => {
  let service: LocationsService;
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
        LocationsService,
        { provide: getRepositoryToken(Location), useValue: repo },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findAll', () => {
    it('lists all clinic locations by default (positive)', async () => {
      repo.find.mockResolvedValue([{ id: 1 }]);
      await service.findAll(1);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clinicId: 1 } }),
      );
    });

    it('filters to active-only when requested (positive)', async () => {
      repo.find.mockResolvedValue([]);
      await service.findAll(1, true);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clinicId: 1, isActive: true } }),
      );
    });
  });

  describe('findOne', () => {
    it('returns location when found (positive)', async () => {
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
    it('creates a location defaulting isActive to true (positive)', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.create({ name: 'Ruang 1' } as any, 1, 9);
      expect(result.data.isActive).toBe(true);
    });

    it('respects an explicit isActive=false (edge)', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.create(
        { name: 'Ruang 1', isActive: false } as any,
        1,
        9,
      );
      expect(result.data.isActive).toBe(false);
    });

    it('throws ConflictException for a duplicate name in the same clinic (negative)', async () => {
      repo.findOne.mockResolvedValue({ id: 5, name: 'Ruang 1' });
      await expect(
        service.create({ name: 'Ruang 1' } as any, 1, 9),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates fields without re-checking name uniqueness when unchanged (positive)', async () => {
      repo.findOne.mockResolvedValueOnce({ id: 1, clinicId: 1, name: 'Ruang 1', type: 'ROOM' });
      const result = await service.update(
        1,
        { type: 'DEPT' } as any,
        1,
        9,
      );
      expect(result.data.type).toBe('DEPT');
      expect(repo.findOne).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException when renaming to a name already used (negative)', async () => {
      repo.findOne
        .mockResolvedValueOnce({ id: 1, clinicId: 1, name: 'Ruang 1' })
        .mockResolvedValueOnce({ id: 2, name: 'Ruang 2' });
      await expect(
        service.update(1, { name: 'Ruang 2' } as any, 1, 9),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when location does not exist (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.update(999, {} as any, 1, 9),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes the location when found (positive)', async () => {
      const location = { id: 1, clinicId: 1 };
      repo.findOne.mockResolvedValue(location);
      await service.remove(1, 1);
      expect(repo.remove).toHaveBeenCalledWith(location);
    });

    it('throws NotFoundException when missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.remove(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('toggleActive', () => {
    it('flips isActive from true to false (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, clinicId: 1, isActive: true });
      const result = await service.toggleActive(1, 1, 9);
      expect(result.data.isActive).toBe(false);
    });

    it('flips isActive from false to true (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, clinicId: 1, isActive: false });
      const result = await service.toggleActive(1, 1, 9);
      expect(result.data.isActive).toBe(true);
    });

    it('throws NotFoundException when missing (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.toggleActive(999, 1, 9)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
