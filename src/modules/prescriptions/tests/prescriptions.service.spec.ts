import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PrescriptionsService } from '../prescriptions.service';
import { PrescriptionItem } from '../entities/prescription-item.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

describe('PrescriptionsService', () => {
  let service: PrescriptionsService;
  let itemRepo: {
    find: jest.Mock;
    count: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let encounterRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    itemRepo = {
      find: jest.fn(),
      count: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      delete: jest.fn(),
    };
    encounterRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrescriptionsService,
        { provide: getRepositoryToken(PrescriptionItem), useValue: itemRepo },
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
      ],
    }).compile();

    service = module.get<PrescriptionsService>(PrescriptionsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('listByEncounter', () => {
    it('lists items ordered by sortOrder for a valid encounter (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      itemRepo.find.mockResolvedValue([{ id: 1 }]);
      const result = await service.listByEncounter(1, 1);
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException for an encounter outside the clinic (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(service.listByEncounter(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('appends a new item with sortOrder equal to the current count (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      itemRepo.count.mockResolvedValue(2);

      const result = await service.create(
        1,
        1,
        { drugName: 'Paracetamol' } as any,
        9,
      );

      expect(itemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 2, createdBy: 9 }),
      );
      expect(result.drugName).toBe('Paracetamol');
    });

    it('starts sortOrder at 0 for the first item (positive/edge)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      itemRepo.count.mockResolvedValue(0);
      await service.create(1, 1, { drugName: 'X' } as any, 9);
      expect(itemRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 0 }),
      );
    });

    it('throws NotFoundException for an encounter outside the clinic (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(999, 1, {} as any, 9),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the item when found (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      itemRepo.delete.mockResolvedValue({ affected: 1 });
      await expect(service.remove(1, 1, 5)).resolves.toBeUndefined();
    });

    it('throws NotFoundException when the item does not exist (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      itemRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.remove(1, 1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for an encounter outside the clinic (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(1, 99, 5)).rejects.toThrow(
        NotFoundException,
      );
      expect(itemRepo.delete).not.toHaveBeenCalled();
    });
  });
});
