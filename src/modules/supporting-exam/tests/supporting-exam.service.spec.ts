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
import { StorageQuotaService } from '../../storage-quota/storage-quota.service';
import { ForbiddenException } from '@nestjs/common';
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

  const storageQuota = {
    assertRoom: jest.fn().mockResolvedValue(undefined),
    record: jest.fn().mockResolvedValue(undefined),
    forget: jest.fn().mockResolvedValue(undefined),
  };

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
        {
          provide: getRepositoryToken(SupportingExamImage),
          useValue: imageRepo,
        },
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
        { provide: StorageQuotaService, useValue: storageQuota },
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

      expect(result.fileUrl).toBe(
        '/encounters/1/supporting-exam-images/1/file',
      );
      expect(result.createdBy).toBe(9);
    });

    it('meters the stored file and rejects (and deletes) an upload over the quota (positive/negative)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      const file = { filename: 'y.jpg', originalname: 'y.jpg', size: 2048 } as any;
      await service.create(1, 1, { imageType: 'photo' } as any, file, 9);
      expect(storageQuota.assertRoom).toHaveBeenCalledWith(1, 2048);
      expect(storageQuota.record).toHaveBeenCalledWith(1, 'supporting-exam', '/uploads/supporting-exam/y.jpg', 2048);

      storageQuota.assertRoom.mockRejectedValueOnce(new ForbiddenException('penuh'));
      (unlinkSync as jest.Mock).mockClear();
      imageRepo.save.mockClear();
      await expect(
        service.create(1, 1, { imageType: 'photo' } as any, file, 9),
      ).rejects.toThrow(ForbiddenException);
      expect(unlinkSync).toHaveBeenCalled();
      expect(imageRepo.save).not.toHaveBeenCalled();
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
      await expect(service.remove(1, 99, 5)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFilePath', () => {
    it('resolves the absolute path for an existing image (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      imageRepo.findOne.mockResolvedValue({
        id: 5,
        encounterId: 1,
        fileUrl: '/uploads/supporting-exam/x.jpg',
        originalName: 'x.jpg',
      });
      (existsSync as jest.Mock).mockReturnValue(true);

      const result = await service.getFilePath(1, 1, 5);

      expect(result.absolutePath).toContain('uploads/supporting-exam/x.jpg');
      expect(result.originalName).toBe('x.jpg');
    });

    it('throws NotFoundException when the file no longer exists on disk (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 1 });
      imageRepo.findOne.mockResolvedValue({
        id: 5,
        encounterId: 1,
        fileUrl: '/uploads/supporting-exam/missing.jpg',
      });
      (existsSync as jest.Mock).mockReturnValue(false);

      await expect(service.getFilePath(1, 1, 5)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException for an encounter outside the clinic (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(service.getFilePath(1, 99, 5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
