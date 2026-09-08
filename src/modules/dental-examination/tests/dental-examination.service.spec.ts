import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DentalExaminationService } from '../dental-examination.service';
import { DentalExamination } from '../entities/dental-examination.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

describe('DentalExaminationService', () => {
  let service: DentalExaminationService;
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
        DentalExaminationService,
        { provide: getRepositoryToken(DentalExamination), useValue: examRepo },
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
      ],
    }).compile();

    service = module.get<DentalExaminationService>(DentalExaminationService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findByEncounter', () => {
    it('returns the exam for a valid encounter (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      examRepo.findOne.mockResolvedValue({ id: 1, encounterId: 1 });

      const result = await service.findByEncounter(1, 1);
      expect(result).toEqual({ id: 1, encounterId: 1 });
    });

    it('returns null when no exam exists yet (positive/edge)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      examRepo.findOne.mockResolvedValue(null);

      const result = await service.findByEncounter(1, 1);
      expect(result).toBeNull();
    });

    it('throws NotFoundException when encounter does not exist in clinic (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(service.findByEncounter(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('upsertForEncounter', () => {
    it('creates a new exam with provided fields (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      examRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertForEncounter(
        1,
        1,
        { notes: 'Catatan', ohisDebris: 1.2 } as any,
        9,
      );

      expect(examRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          encounterId: 1,
          notes: 'Catatan',
          ohisDebris: 1.2,
          createdBy: 9,
        }),
      );
      expect(result.notes).toBe('Catatan');
    });

    it('merges into an existing exam, keeping old values for omitted fields (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      const existing = {
        id: 5,
        encounterId: 1,
        notes: 'Old note',
        ohisDebris: 1.0,
        ohisCalculus: 0.5,
      };
      examRepo.findOne.mockResolvedValue(existing);

      const result = await service.upsertForEncounter(
        1,
        1,
        { ohisDebris: 2.0 } as any,
        9,
      );

      expect(result.ohisDebris).toBe(2.0);
      expect(result.ohisCalculus).toBe(0.5); // preserved
      expect(result.notes).toBe('Old note'); // preserved
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
