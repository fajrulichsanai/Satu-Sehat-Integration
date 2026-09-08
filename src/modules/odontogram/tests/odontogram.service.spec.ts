import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { OdontogramService } from '../odontogram.service';
import { ToothCondition } from '../entities/tooth-condition.entity';
import { DentalBridge } from '../entities/dental-bridge.entity';
import { Patient } from '../../patients/entities/patient.entity';

describe('OdontogramService', () => {
  let service: OdontogramService;
  let toothRepo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let bridgeRepo: { find: jest.Mock; create: jest.Mock; save: jest.Mock; delete: jest.Mock };
  let patientRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    toothRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };
    bridgeRepo = {
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      delete: jest.fn(),
    };
    patientRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OdontogramService,
        { provide: getRepositoryToken(ToothCondition), useValue: toothRepo },
        { provide: getRepositoryToken(DentalBridge), useValue: bridgeRepo },
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
      ],
    }).compile();

    service = module.get<OdontogramService>(OdontogramService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('getOdontogram', () => {
    it('returns teeth and bridges for an existing patient (positive)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      toothRepo.find.mockResolvedValue([{ toothNumber: 11 }]);
      bridgeRepo.find.mockResolvedValue([{ id: 1 }]);

      const result = await service.getOdontogram(1, 1);

      expect(result.teeth).toHaveLength(1);
      expect(result.bridges).toHaveLength(1);
    });

    it('throws NotFoundException when patient does not exist (negative)', async () => {
      patientRepo.findOne.mockResolvedValue(null);
      await expect(service.getOdontogram(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('upsertTooth', () => {
    it('creates a new tooth condition (positive)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      toothRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertTooth(
        1,
        1,
        11,
        { wholeCondition: 'caries', surfaceMesial: 'filled' } as any,
        9,
      );

      expect(toothRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          toothNumber: 11,
          wholeCondition: 'caries',
          surfaceMesial: 'filled',
          createdBy: 9,
        }),
      );
      expect(result.wholeCondition).toBe('caries');
    });

    it('merges into an existing tooth, preserving surfaces not provided (positive)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      toothRepo.findOne.mockResolvedValue({
        id: 5,
        toothNumber: 11,
        wholeCondition: 'sound',
        surfaceMesial: 'filled',
        surfaceDistal: 'sound',
      });

      const result = await service.upsertTooth(
        1,
        1,
        11,
        { surfaceDistal: 'caries' } as any,
        9,
      );

      expect(result.surfaceMesial).toBe('filled'); // preserved
      expect(result.surfaceDistal).toBe('caries');
      expect(result.wholeCondition).toBe('sound'); // preserved
      expect(result.updatedBy).toBe(9);
    });

    it('throws NotFoundException when patient does not exist (negative)', async () => {
      patientRepo.findOne.mockResolvedValue(null);
      await expect(
        service.upsertTooth(999, 1, 11, {} as any, 9),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createBridge', () => {
    it('creates a bridge with a default label when none given (positive)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });

      const result = await service.createBridge(
        1,
        1,
        { fromTooth: 11, toTooth: 13 } as any,
        9,
      );

      expect(result.label).toBe('Gigi Tiruan Cekat');
    });

    it('uses a custom label when provided (positive)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      const result = await service.createBridge(
        1,
        1,
        { fromTooth: 11, toTooth: 13, label: 'Custom' } as any,
        9,
      );
      expect(result.label).toBe('Custom');
    });

    it('throws NotFoundException when patient does not exist (negative)', async () => {
      patientRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createBridge(999, 1, {} as any, 9),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeBridge', () => {
    it('deletes the bridge when it exists (positive)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      bridgeRepo.delete.mockResolvedValue({ affected: 1 });
      await expect(service.removeBridge(1, 1, 5)).resolves.toBeUndefined();
    });

    it('throws NotFoundException when the bridge does not exist (negative)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      bridgeRepo.delete.mockResolvedValue({ affected: 0 });
      await expect(service.removeBridge(1, 1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when the patient does not exist (negative)', async () => {
      patientRepo.findOne.mockResolvedValue(null);
      await expect(service.removeBridge(999, 1, 5)).rejects.toThrow(
        NotFoundException,
      );
      expect(bridgeRepo.delete).not.toHaveBeenCalled();
    });
  });
});
