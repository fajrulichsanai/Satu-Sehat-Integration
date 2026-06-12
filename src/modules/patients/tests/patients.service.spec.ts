import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PatientsService } from '../patients.service';
import { Patient } from '../../../entities/patient.entity';
import { Encounter } from '../../../entities/encounter.entity';
import { SatusehatClientService } from '../../satusehat/satusehat-client.service';
import { DataSource } from 'typeorm';

const mockPatientRepo = {
  createQueryBuilder: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  query: jest.fn(),
};

const mockEncounterRepo = { find: jest.fn() };
const mockDataSource = { transaction: jest.fn() };
const mockSatusehatClient = { searchPatientByNik: jest.fn() };

describe('PatientsService', () => {
  let service: PatientsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: getRepositoryToken(Patient), useValue: mockPatientRepo },
        { provide: getRepositoryToken(Encounter), useValue: mockEncounterRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: SatusehatClientService, useValue: mockSatusehatClient },
      ],
    }).compile();
    service = module.get<PatientsService>(PatientsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findOne', () => {
    it('should throw NotFoundException if patient not found', async () => {
      mockPatientRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, 1)).rejects.toThrow(NotFoundException);
    });

    it('should return patient if found', async () => {
      const patient = { id: 1, name: 'Ahmad', clinicId: 1 };
      mockPatientRepo.findOne.mockResolvedValue(patient);
      const result = await service.findOne(1, 1);
      expect(result).toEqual(patient);
    });
  });

  describe('create', () => {
    it('should throw BadRequestException if non-newborn has no NIK', async () => {
      await expect(service.create(1, { name: 'Test', isNewborn: false } as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('searchSatusehat', () => {
    it('should throw if NIK is empty', async () => {
      await expect(service.searchSatusehat('', 1)).rejects.toThrow(BadRequestException);
    });

    it('should call satusehat client with NIK', async () => {
      mockSatusehatClient.searchPatientByNik.mockResolvedValue({ entry: [] });
      await service.searchSatusehat('1234567890123456', 1);
      expect(mockSatusehatClient.searchPatientByNik).toHaveBeenCalledWith(1, '1234567890123456');
    });
  });
});
