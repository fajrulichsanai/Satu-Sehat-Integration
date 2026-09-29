import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PhysicalExaminationService } from '../physical-examination.service';
import { PhysicalExamination } from '../entities/physical-examination.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

describe('PhysicalExaminationService', () => {
  let service: PhysicalExaminationService;
  let examRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let encounterRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    examRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };
    encounterRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhysicalExaminationService,
        { provide: getRepositoryToken(PhysicalExamination), useValue: examRepo },
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
      ],
    }).compile();

    service = module.get<PhysicalExaminationService>(
      PhysicalExaminationService,
    );
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findByEncounter', () => {
    it('returns the exam for a valid encounter (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      examRepo.findOne.mockResolvedValue({ id: 1, encounterId: 1 });
      const result = await service.findByEncounter(1, 1);
      expect(result).toEqual({ id: 1, encounterId: 1 });
    });

    it('throws NotFoundException when encounter is not in the clinic (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(service.findByEncounter(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('upsertForEncounter', () => {
    it('creates a new exam with provided vitals (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      examRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertForEncounter(
        1,
        1,
        { temperature: 36.5, pulseRate: 80 } as any,
        9,
      );

      expect(examRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          encounterId: 1,
          temperature: 36.5,
          pulseRate: 80,
          createdBy: 9,
        }),
      );
      expect(result.temperature).toBe(36.5);
    });

    it('merges into an existing exam, preserving fields not provided (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      examRepo.findOne.mockResolvedValue({
        id: 5,
        encounterId: 1,
        temperature: 36.0,
        pulseRate: 75,
      });

      const result = await service.upsertForEncounter(
        1,
        1,
        { pulseRate: 90 } as any,
        9,
      );

      expect(result.temperature).toBe(36.0); // preserved
      expect(result.pulseRate).toBe(90);
      expect(result.updatedBy).toBe(9);
    });

    it('throws NotFoundException when encounter does not exist (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(
        service.upsertForEncounter(999, 1, {} as any, 9),
      ).rejects.toThrow(NotFoundException);
      expect(examRepo.save).not.toHaveBeenCalled();
    });
  });
});
