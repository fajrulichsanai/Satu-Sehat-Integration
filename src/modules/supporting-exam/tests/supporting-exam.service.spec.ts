import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  unlinkSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

import { existsSync, unlinkSync } from 'fs';
import { SupportingExamService } from '../supporting-exam.service';
import { SupportingExamImage } from '../entities/supporting-exam-image.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';

describe('SupportingExamService', () => {
  let service: SupportingExamService;
  let imageRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let encounterRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    imageRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      delete: jest.fn(),
    };
    encounterRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupportingExamService,
        { provide: getRepositoryToken(SupportingExamImage), useValue: imageRepo },
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
      ],
    }).compile();

    service = module.get<SupportingExamService>(SupportingExamService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('listByEncounter', () => {
    it('lists images for a valid encounter (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      imageRepo.find.mockResolvedValue([{ id: 1 }]);
      const result = await service.listByEncounter(1, 1);
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException for an encounter outside the clinic (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(service.listByEncounter(1, 99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('saves an image with the uploaded file URL (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });

      const result = await service.create(
        1,
        1,
        { imageType: 'photo' } as any,
        { filename: 'x.jpg', originalname: 'x.jpg' } as any,
        9,
      );

      expect(result.fileUrl).toBe('/uploads/supporting-exam/x.jpg');
      expect(result.createdBy).toBe(9);
    });

    it('throws BadRequestException when no file is uploaded (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      await expect(
        service.create(1, 1, { imageType: 'photo' } as any, undefined, 9),
      ).rejects.toThrow(BadRequestException);
      expect(imageRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an encounter outside the clinic (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(999, 1, {} as any, { filename: 'x.jpg' } as any, 9),
      ).rejects.toThrow(NotFoundException);
    });

    it('defaults category to null when omitted (edge)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      const result = await service.create(
        1,
        1,
        { imageType: 'photo' } as any,
        { filename: 'x.jpg' } as any,
        9,
      );
      expect(result.category).toBeNull();
    });
  });

  describe('remove', () => {
    it('deletes the DB row and the file on disk when it exists (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      imageRepo.findOne.mockResolvedValue({
        id: 5,
        encounterId: 1,
        fileUrl: '/uploads/supporting-exam/x.jpg',
      });
      (existsSync as jest.Mock).mockReturnValue(true);

      await service.remove(1, 1, 5);

      expect(imageRepo.delete).toHaveBeenCalledWith({ id: 5 });
      expect(unlinkSync).toHaveBeenCalled();
    });

    it('does not attempt to unlink a file that no longer exists on disk (negative/edge)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      imageRepo.findOne.mockResolvedValue({
        id: 5,
        encounterId: 1,
        fileUrl: '/uploads/supporting-exam/missing.jpg',
      });
      (existsSync as jest.Mock).mockReturnValue(false);

      await service.remove(1, 1, 5);

      expect(unlinkSync).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the image does not exist (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      imageRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(1, 1, 999)).rejects.toThrow(
        NotFoundException,
      );
      expect(imageRepo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an encounter outside the clinic (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(service.remove(1, 99, 5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
