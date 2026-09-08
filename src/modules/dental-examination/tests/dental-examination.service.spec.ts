import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DentalExaminationService } from '../dental-examination.service';
import { DentalExamination } from '../entities/dental-examination.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

describe('DentalExaminationService', () => {
  let service: DentalExaminationService;

  const mockExamRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockEncounterRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DentalExaminationService,
        {
          provide: getRepositoryToken(DentalExamination),
          useValue: mockExamRepository,
        },
        {
          provide: getRepositoryToken(Encounter),
          useValue: mockEncounterRepository,
        },
      ],
    }).compile();

    service = module.get<DentalExaminationService>(DentalExaminationService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByEncounter', () => {
    it('throws NotFoundException when the encounter does not belong to the clinic (negative)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue(null);

      await expect(service.findByEncounter(1, 1)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockExamRepository.findOne).not.toHaveBeenCalled();
    });

    it('returns null when no exam record exists yet for the encounter (positive)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      mockExamRepository.findOne.mockResolvedValue(null);

      await expect(service.findByEncounter(1, 1)).resolves.toBeNull();
    });

    it('returns the existing exam record for the encounter (positive)', async () => {
      const exam = { id: 1, encounterId: 1, ohisDebris: 1 };
      mockEncounterRepository.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      mockExamRepository.findOne.mockResolvedValue(exam);

      await expect(service.findByEncounter(1, 1)).resolves.toBe(exam);
    });
  });

  describe('upsertForEncounter', () => {
    it('rejects when the encounter does not exist for the clinic (negative)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue(null);

      await expect(
        service.upsertForEncounter(1, 1, { ohisDebris: 2 } as any, 10),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates a new exam record when none exists yet (positive)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      mockExamRepository.findOne.mockResolvedValue(null);
      mockExamRepository.create.mockImplementation((e) => e);
      mockExamRepository.save.mockImplementation((e) =>
        Promise.resolve({ id: 1, ...e }),
      );

      const result = await service.upsertForEncounter(
        1,
        1,
        { ohisDebris: 2, notes: 'Karang gigi ringan' },
        10,
      );

      expect(mockExamRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          encounterId: 1,
          createdBy: 10,
          ohisDebris: 2,
        }),
      );
      expect((result as any).notes).toBe('Karang gigi ringan');
    });

    it('updates the existing exam record, preserving unspecified fields (positive)', async () => {
      const existing = {
        id: 1,
        encounterId: 1,
        notes: 'Lama',
        ohisDebris: 1,
        ohisCalculus: 1,
        gingivalIndex: 1,
        plaqueSurfacesWithPlaque: 2,
        plaqueSurfacesExamined: 10,
        probingDepths: null,
      };
      mockEncounterRepository.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      mockExamRepository.findOne.mockResolvedValue(existing);
      mockExamRepository.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.upsertForEncounter(
        1,
        1,
        { ohisDebris: 3 },
        20,
      );

      expect((result as any).ohisDebris).toBe(3);
      // Fields not present in the DTO keep their previous value.
      expect((result as any).ohisCalculus).toBe(1);
      expect((result as any).notes).toBe('Lama');
      expect((result as any).updatedBy).toBe(20);
    });
  });
});
