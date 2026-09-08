import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PatientsService } from '../patients.service';
import { Patient } from '../entities/patient.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { EncounterSoapNote } from '../../encounter-soap-notes/entities/encounter-soap-note.entity';
import { Billing } from '../../billing/entities/billing.entity';
import { SupportingExamImage } from '../../supporting-exam/entities/supporting-exam-image.entity';
import { PatientRecall } from '../../recalls/entities/patient-recall.entity';
import { SatusehatClientService } from '../../satusehat/satusehat-client.service';
import { TreatmentPlansService } from '../../treatment-plans/treatment-plans.service';

describe('PatientsService', () => {
  let service: PatientsService;

  const qbMock = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  const mockPatientRepository = {
    createQueryBuilder: jest.fn(() => qbMock),
    findOne: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const mockEncounterRepository = {};
  const mockEncounterSoapNoteRepository = {};
  const mockBillingRepository = {};
  const mockSupportingExamImageRepository = {};
  const mockPatientRecallRepository = {};

  const manager = {
    query: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
    query: jest.fn(),
  };

  const mockSatusehatClient = {
    searchPatientByNik: jest.fn(),
  };
  const mockTreatmentPlansService = {
    findByPatient: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        {
          provide: getRepositoryToken(Patient),
          useValue: mockPatientRepository,
        },
        {
          provide: getRepositoryToken(Encounter),
          useValue: mockEncounterRepository,
        },
        {
          provide: getRepositoryToken(EncounterSoapNote),
          useValue: mockEncounterSoapNoteRepository,
        },
        {
          provide: getRepositoryToken(Billing),
          useValue: mockBillingRepository,
        },
        {
          provide: getRepositoryToken(SupportingExamImage),
          useValue: mockSupportingExamImageRepository,
        },
        {
          provide: getRepositoryToken(PatientRecall),
          useValue: mockPatientRecallRepository,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: SatusehatClientService, useValue: mockSatusehatClient },
        {
          provide: TreatmentPlansService,
          useValue: mockTreatmentPlansService,
        },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
    jest.clearAllMocks();
    mockDataSource.transaction.mockImplementation((cb: any) => cb(manager));
    qbMock.where.mockReturnThis();
    qbMock.andWhere.mockReturnThis();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('throws NotFoundException when the patient does not exist for the clinic (negative)', async () => {
      mockPatientRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('returns the patient when found (positive)', async () => {
      const patient = { id: 1, clinicId: 1 };
      mockPatientRepository.findOne.mockResolvedValue(patient);

      await expect(service.findOne(1, 1)).resolves.toBe(patient);
    });
  });

  describe('create', () => {
    const clinicId = 1;
    const dto = { name: 'Budi', nik: '3171234567890001' } as any;

    it('rejects when the NIK is already registered in the clinic (negative)', async () => {
      qbMock.getOne.mockResolvedValue({ id: 5, nik: dto.nik });

      await expect(service.create(clinicId, dto)).rejects.toThrow(
        ConflictException,
      );
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('creates a patient with an auto-generated no_rm (positive)', async () => {
      qbMock.getOne.mockResolvedValue(null);
      manager.query.mockResolvedValue([{ no_rm: '000005' }]);
      manager.create.mockImplementation((_entity, data) => data);
      manager.save.mockImplementation((data) =>
        Promise.resolve({ id: 1, ...data }),
      );

      const result = await service.create(clinicId, dto);

      expect((result as any).noRm).toBe('000006');
      expect((result as any).clinicId).toBe(clinicId);
    });

    it('allows creating a patient without a NIK, e.g. an infant (positive)', async () => {
      qbMock.getOne.mockResolvedValue(null);
      manager.query.mockResolvedValue([]);
      manager.create.mockImplementation((_entity, data) => data);
      manager.save.mockImplementation((data) =>
        Promise.resolve({ id: 2, ...data }),
      );

      const result = await service.create(clinicId, {
        name: 'Bayi Budi',
      } as any);

      expect((result as any).noRm).toBe('000001');
      expect(qbMock.getOne).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundException when the patient does not exist (negative)', async () => {
      mockPatientRepository.findOne.mockResolvedValue(null);

      await expect(service.update(1, 1, { name: 'X' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('rejects updating to a NIK already used by another patient (negative)', async () => {
      mockPatientRepository.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        nik: 'OLDNIK',
      });
      qbMock.getOne.mockResolvedValue({ id: 2, nik: 'TAKEN' });

      await expect(
        service.update(1, 1, { nik: 'TAKEN' } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('updates patient fields (positive)', async () => {
      const patient = { id: 1, clinicId: 1, nik: 'OLDNIK', name: 'Old Name' };
      mockPatientRepository.findOne.mockResolvedValue(patient);
      mockPatientRepository.save.mockImplementation((p) => Promise.resolve(p));

      const result = await service.update(1, 1, { name: 'New Name' });

      expect((result as any).name).toBe('New Name');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when the patient does not exist (negative)', async () => {
      mockPatientRepository.findOne.mockResolvedValue(null);

      await expect(service.remove(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('rejects deleting a patient with existing encounter/billing history (negative)', async () => {
      mockPatientRepository.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      mockDataSource.query
        .mockResolvedValueOnce([{ total: '2' }])
        .mockResolvedValueOnce([{ total: '0' }]);

      await expect(service.remove(1, 1)).rejects.toThrow(ConflictException);
      expect(mockPatientRepository.remove).not.toHaveBeenCalled();
    });

    it('removes a patient with no related history (positive)', async () => {
      const patient = { id: 1, clinicId: 1 };
      mockPatientRepository.findOne.mockResolvedValue(patient);
      mockDataSource.query
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ total: '0' }]);
      mockPatientRepository.remove.mockResolvedValue(patient);

      await service.remove(1, 1);

      expect(mockPatientRepository.remove).toHaveBeenCalledWith(patient);
    });
  });

  describe('searchSatusehat', () => {
    it('rejects an empty NIK (negative)', async () => {
      await expect(service.searchSatusehat('', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('delegates to the SATUSEHAT client for a valid NIK (positive)', async () => {
      mockSatusehatClient.searchPatientByNik.mockResolvedValue({ found: true });

      const result = await service.searchSatusehat('3171234567890001', 1);

      expect(result).toEqual({ found: true });
      expect(mockSatusehatClient.searchPatientByNik).toHaveBeenCalledWith(
        1,
        '3171234567890001',
      );
    });
  });
});
