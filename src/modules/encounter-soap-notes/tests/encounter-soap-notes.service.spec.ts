import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EncounterSoapNotesService } from '../encounter-soap-notes.service';
import { EncounterSoapNote } from '../entities/encounter-soap-note.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { TerminologyService } from '../../terminology/terminology.service';

const CONCEPTS: Record<string, string> = {
  'icd10:K02.1': 'Caries of dentine',
  'icd10:K05.1': 'Chronic gingivitis',
  'snomed:80967001': 'Dental caries',
};
const terminology = {
  resolve: jest.fn(async (items: Array<{ system: string; code: string }>) => {
    const missing = items.find((i) => !CONCEPTS[`${i.system}:${i.code}`]);
    if (missing)
      throw new BadRequestException(
        `Kode diagnosis ${missing.code} tidak dikenal`,
      );
    return new Map(
      items.map((i) => [
        `${i.system}:${i.code}`,
        { display: CONCEPTS[`${i.system}:${i.code}`] },
      ]),
    );
  }),
};

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
        { provide: TerminologyService, useValue: terminology },
      ],
    }).compile();

    service = module.get<EncounterSoapNotesService>(EncounterSoapNotesService);
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

  describe('diagnoses', () => {
    beforeEach(() => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      noteRepo.findOne.mockResolvedValue(null);
    });

    it('stores the code system name, drops duplicates, first becomes primary (positive)', async () => {
      const note: any = await service.upsertForEncounter(
        1,
        1,
        {
          diagnoses: [
            { system: 'icd10', code: 'K02.1', note: ' gigi 36 ' },
            { system: 'snomed', code: '80967001' },
            { system: 'icd10', code: 'K02.1' },
          ],
        } as any,
        7,
      );
      expect(note.diagnoses).toEqual([
        {
          system: 'icd10',
          code: 'K02.1',
          display: 'Caries of dentine',
          primary: true,
          note: 'gigi 36',
        },
        {
          system: 'snomed',
          code: '80967001',
          display: 'Dental caries',
          primary: false,
          note: null,
        },
      ]);
    });

    it('keeps the diagnosis marked primary (positive)', async () => {
      const note: any = await service.upsertForEncounter(
        1,
        1,
        {
          diagnoses: [
            { system: 'icd10', code: 'K02.1' },
            { system: 'icd10', code: 'K05.1', primary: true },
          ],
        } as any,
        7,
      );
      expect(note.diagnoses.map((d: any) => d.primary)).toEqual([false, true]);
    });

    it('rejects unknown codes and two primary diagnoses (negative)', async () => {
      await expect(
        service.upsertForEncounter(
          1,
          1,
          { diagnoses: [{ system: 'icd10', code: 'XX9.9' }] } as any,
          7,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.upsertForEncounter(
          1,
          1,
          {
            diagnoses: [
              { system: 'icd10', code: 'K02.1', primary: true },
              { system: 'icd10', code: 'K05.1', primary: true },
            ],
          } as any,
          7,
        ),
      ).rejects.toThrow('Hanya boleh satu diagnosis utama');
    });

    it('leaves saved diagnoses alone when the field is not sent (edge)', async () => {
      noteRepo.findOne.mockResolvedValue({
        id: 1,
        encounterId: 1,
        diagnoses: [{ code: 'K02.1' }],
      });
      const note: any = await service.upsertForEncounter(
        1,
        1,
        { assessment: 'x' } as any,
        7,
      );
      expect(note.diagnoses).toEqual([{ code: 'K02.1' }]);
      const cleared: any = await service.upsertForEncounter(
        1,
        1,
        { diagnoses: [] } as any,
        7,
      );
      expect(cleared.diagnoses).toEqual([]);
    });
  });
});
