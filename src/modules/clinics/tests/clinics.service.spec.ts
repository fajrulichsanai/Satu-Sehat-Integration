import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { ClinicsService } from '../clinics.service';
import { Clinic } from '../../../entities/clinic.entity';

const mockRepo = { findOne: jest.fn(), save: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue('test-encryption-key-32-chars!!!') };

describe('ClinicsService', () => {
  let service: ClinicsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: getRepositoryToken(Clinic), useValue: mockRepo },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<ClinicsService>(ClinicsService);
    jest.clearAllMocks();
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('getClinicSettings', () => {
    it('should throw NotFoundException if clinic not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.getClinicSettings(999)).rejects.toThrow(NotFoundException);
    });

    it('should return clinic without secret fields', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 1, name: 'Klinik Test', satusehatClientSecret: 'secret', satusehatToken: 'token',
      });
      const result = await service.getClinicSettings(1) as any;
      expect(result.satusehatClientSecret).toBeUndefined();
    });
  });
});
