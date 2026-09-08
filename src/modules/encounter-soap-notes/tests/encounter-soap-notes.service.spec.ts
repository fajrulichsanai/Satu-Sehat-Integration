import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { EncounterSoapNotesService } from '../encounter-soap-notes.service';
import { EncounterSoapNote } from '../entities/encounter-soap-note.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

describe('EncounterSoapNotesService', () => {
  let service: EncounterSoapNotesService;
  let noteRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let encounterRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    noteRepo = {
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };
    encounterRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncounterSoapNotesService,
        { provide: getRepositoryToken(EncounterSoapNote), useValue: noteRepo },
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
      ],
    }).compile();

    service = module.get<EncounterSoapNotesService>(
      EncounterSoapNotesService,
    );
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findByEncounter', () => {
    it('returns the note for a valid encounter (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      noteRepo.findOne.mockResolvedValue({ id: 1, encounterId: 1 });
      const result = await service.findByEncounter(1, 1);
      expect(result).toEqual({ id: 1, encounterId: 1 });
    });

    it('throws NotFoundException for an encounter outside the clinic (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(service.findByEncounter(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('upsertForEncounter', () => {
    it('creates a new SOAP note (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      noteRepo.findOne.mockResolvedValue(null);

      const result = await service.upsertForEncounter(
        1,
        1,
        { subjective: 'Pasien mengeluh sakit gigi' } as any,
        9,
      );

      expect(noteRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          encounterId: 1,
          subjective: 'Pasien mengeluh sakit gigi',
          createdBy: 9,
        }),
      );
      expect(result.subjective).toBe('Pasien mengeluh sakit gigi');
    });

    it('merges into an existing note, keeping fields not provided (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      noteRepo.findOne.mockResolvedValue({
        id: 5,
        encounterId: 1,
        subjective: 'Old S',
        objective: 'Old O',
      });

      const result = await service.upsertForEncounter(
        1,
        1,
        { objective: 'New O' } as any,
        9,
      );

      expect(result.subjective).toBe('Old S');
      expect(result.objective).toBe('New O');
      expect(result.updatedBy).toBe(9);
    });

    it('throws NotFoundException when encounter does not exist (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(
        service.upsertForEncounter(999, 1, {} as any, 9),
      ).rejects.toThrow(NotFoundException);
      expect(noteRepo.save).not.toHaveBeenCalled();
    });
  });
});
