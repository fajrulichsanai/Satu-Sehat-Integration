import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ClinicsService } from '../clinics.service';
import { Clinic } from '../entities/clinic.entity';
import { S3StorageService } from '../../../common/storage/s3-storage.service';

describe('ClinicsService', () => {
  let service: ClinicsService;
  let repo: { find: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let s3: { uploadBuffer: jest.Mock };

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn((data) => Promise.resolve(data)),
    };
    s3 = { uploadBuffer: jest.fn().mockResolvedValue('https://cdn/x/logo.png') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicsService,
        { provide: getRepositoryToken(Clinic), useValue: repo },
        { provide: ConfigService, useValue: { get: jest.fn(() => 'test') } },
        { provide: S3StorageService, useValue: s3 },
      ],
    }).compile();

    service = module.get<ClinicsService>(ClinicsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findAllForSuperAdmin', () => {
    it('returns all clinics ordered by name (positive)', async () => {
      repo.find.mockResolvedValue([{ id: 1, name: 'A' }]);
      const result = await service.findAllForSuperAdmin();
      expect(result.data).toHaveLength(1);
      expect(repo.find).toHaveBeenCalledWith({ order: { name: 'ASC' } });
    });
  });

  describe('findOne', () => {
    it('returns clinic when found (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, name: 'Klinik A' });
      const result = await service.findOne(1);
      expect(result.data.name).toBe('Klinik A');
    });

    it('throws NotFoundException when not found (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('merges dto fields into the clinic (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, name: 'Old' });
      const result = await service.update(1, { name: 'New' } as any, 7);
      expect(result.data.name).toBe('New');
      expect(result.data.updatedBy).toBe(7);
    });

    it('marks setupComplete true once all required fields are present (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      const result = await service.update(
        1,
        {
          name: 'Klinik A',
          address: 'Jl. A',
          city: 'Jakarta',
          province: 'DKI',
          phone: '0800',
        } as any,
        7,
      );
      expect(result.data.setupComplete).toBe(true);
    });

    it('does not mark setupComplete when a required field is still missing (negative/edge)', async () => {
      repo.findOne.mockResolvedValue({ id: 1, phone: undefined });
      const result = await service.update(
        1,
        { name: 'Klinik A', address: 'Jl. A', city: 'Jakarta', province: 'DKI' } as any,
        7,
      );
      expect(result.data.setupComplete).toBeUndefined();
    });

    it('throws NotFoundException when clinic does not exist (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(
        service.update(999, {} as any, 7),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('uploadLogo', () => {
    const file = {
      originalname: 'logo.png',
      buffer: Buffer.from('x'),
      mimetype: 'image/png',
    } as any;

    it('uploads to S3 and persists the logoUrl (positive)', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      const result = await service.uploadLogo(1, file);
      expect(s3.uploadBuffer).toHaveBeenCalled();
      expect(result.data.logoUrl).toBe('https://cdn/x/logo.png');
    });

    it('throws BadRequestException when no file is provided (negative)', async () => {
      await expect(service.uploadLogo(1, undefined)).rejects.toThrow(
        BadRequestException,
      );
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when clinic does not exist (negative)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.uploadLogo(999, file)).rejects.toThrow(
        NotFoundException,
      );
      expect(s3.uploadBuffer).not.toHaveBeenCalled();
    });

    it('falls back to jpg extension when the filename has none (edge)', async () => {
      repo.findOne.mockResolvedValue({ id: 1 });
      await service.uploadLogo(1, { ...file, originalname: 'logo' });
      const key = s3.uploadBuffer.mock.calls[0][0];
      expect(key.endsWith('.jpg')).toBe(true);
    });
  });
});
