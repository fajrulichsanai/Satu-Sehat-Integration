import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  unlinkSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

import { existsSync, unlinkSync } from 'fs';
import { ClinicalPhotosService } from '../clinical-photos.service';
import { PhotoTemplateGroup } from '../entities/photo-template-group.entity';
import { PhotoTemplate } from '../entities/photo-template.entity';
import { PatientPhoto } from '../entities/patient-photo.entity';
import { ClinicDisabledPhotoGroup } from '../entities/clinic-disabled-photo-group.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { StorageQuotaService } from '../../storage-quota/storage-quota.service';

describe('ClinicalPhotosService', () => {
  let service: ClinicalPhotosService;
  let groupRepo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let templateRepo: { find: jest.Mock; findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let photoRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let disabledRepo: { find: jest.Mock; delete: jest.Mock; save: jest.Mock };
  let patientRepo: { findOne: jest.Mock; save: jest.Mock };
  let encounterRepo: { findOne: jest.Mock };

  const storageQuota = {
    assertRoom: jest.fn().mockResolvedValue(undefined),
    record: jest.fn().mockResolvedValue(undefined),
    forget: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    groupRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((d) => d),
      save: jest.fn((d) => Promise.resolve({ id: 1, ...d })),
    };
    templateRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((d) => d),
      save: jest.fn((d) => Promise.resolve({ id: 1, ...d })),
    };
    photoRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((d) => d),
      save: jest.fn((d) => Promise.resolve({ id: 1, ...d })),
      delete: jest.fn(),
    };
    disabledRepo = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
      save: jest.fn(),
    };
    patientRepo = { findOne: jest.fn(), save: jest.fn((d) => Promise.resolve(d)) };
    encounterRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClinicalPhotosService,
        { provide: getRepositoryToken(PhotoTemplateGroup), useValue: groupRepo },
        { provide: getRepositoryToken(PhotoTemplate), useValue: templateRepo },
        { provide: getRepositoryToken(PatientPhoto), useValue: photoRepo },
        {
          provide: getRepositoryToken(ClinicDisabledPhotoGroup),
          useValue: disabledRepo,
        },
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
        { provide: StorageQuotaService, useValue: storageQuota },
      ],
    }).compile();

    service = module.get<ClinicalPhotosService>(ClinicalPhotosService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('listGroups', () => {
    it('hides a system-default group a clinic disabled for itself only (positive)', async () => {
      groupRepo.find.mockResolvedValue([
        { id: 1, clinicId: null, name: 'Behel', sortOrder: 0, isActive: true, templates: [] },
        { id: 2, clinicId: 5, name: 'Bedah Minor', sortOrder: 0, isActive: true, templates: [] },
      ]);
      disabledRepo.find.mockResolvedValue([{ clinicId: 5, groupId: 1 }]);

      const result = await service.listGroups(5, { activeOnly: true });

      expect(result.map((g) => g.id)).toEqual([2]);
    });

    it('keeps a system-default group visible for a clinic that has not disabled it (positive)', async () => {
      groupRepo.find.mockResolvedValue([
        { id: 1, clinicId: null, name: 'Behel', sortOrder: 0, isActive: true, templates: [] },
      ]);
      disabledRepo.find.mockResolvedValue([]);

      const result = await service.listGroups(9, { activeOnly: true });

      expect(result.map((g) => g.id)).toEqual([1]);
    });
  });

  describe('updateGroup', () => {
    it('rejects renaming a system-default group (negative)', async () => {
      groupRepo.findOne.mockResolvedValue({ id: 1, clinicId: null, name: 'Behel' });
      await expect(
        service.updateGroup(5, 9, 1, { name: 'Hacked' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a clinic to disable a system-default group for itself (positive)', async () => {
      groupRepo.findOne.mockResolvedValue({ id: 1, clinicId: null, name: 'Behel' });
      await service.updateGroup(5, 9, 1, { isActive: false });
      expect(disabledRepo.save).toHaveBeenCalledWith({ clinicId: 5, groupId: 1 });
    });

    it('allows a clinic to rename its own folder (positive)', async () => {
      groupRepo.findOne.mockResolvedValue({ id: 2, clinicId: 5, name: 'Old' });
      await service.updateGroup(5, 9, 2, { name: 'New Name' });
      expect(groupRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Name', updatedBy: 9 }),
      );
    });

    it('throws NotFoundException for another clinic’s folder (negative)', async () => {
      groupRepo.findOne.mockResolvedValue({ id: 2, clinicId: 7, name: 'Other' });
      await expect(
        service.updateGroup(5, 9, 2, { name: 'Hijack' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('upload', () => {
    it('rejects a template slot from a different clinic’s own folder (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 5, patientId: 10 });
      templateRepo.findOne.mockResolvedValue({
        id: 3,
        group: { id: 2, clinicId: 7 },
      });
      await expect(
        service.upload(1, 5, 9, 3, undefined, { filename: 'x.jpg' } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts a system-default template slot for any clinic (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 5, patientId: 10 });
      templateRepo.findOne.mockResolvedValue({
        id: 3,
        group: { id: 1, clinicId: null },
      });
      const result = await service.upload(
        1,
        5,
        9,
        3,
        4000,
        { filename: 'x.jpg', size: 1200 } as any,
      );
      expect(result.patientId).toBe(10);
      expect(result.originalSizeBytes).toBe(4000);
      expect(result.compressedSizeBytes).toBe(1200);
      expect(result.fileUrl).toBe('/encounters/1/photos/1/file');
    });

    it('throws NotFoundException for an encounter outside the clinic (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(
        service.upload(999, 5, 9, undefined, undefined, { filename: 'x.jpg' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setConsent / isConsented', () => {
    it('records who/when consent changed (positive)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 10, clinicId: 5 });
      const result = await service.setConsent(10, 5, 9, true);
      expect(result.photoConsentMarketing).toBe(true);
      expect(result.photoConsentUpdatedBy).toBe(9);
      expect(result.photoConsentUpdatedAt).toBeInstanceOf(Date);
    });

    it('treats an explicit null the same as "not decided" (edge)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 10, clinicId: 5 });
      const result = await service.setConsent(10, 5, 9, null);
      expect(result.photoConsentMarketing).toBeNull();
    });

    it('is false for a patient who has not consented (negative)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 10, clinicId: 5, photoConsentMarketing: null });
      await expect(service.isConsented(10, 5)).resolves.toBe(false);
    });

    it('is true only when consent is exactly true (positive)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 10, clinicId: 5, photoConsentMarketing: true });
      await expect(service.isConsented(10, 5)).resolves.toBe(true);
    });
  });

  describe('remove', () => {
    it('deletes the DB row and the file on disk (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, clinicId: 5 });
      photoRepo.findOne.mockResolvedValue({
        id: 3,
        encounterId: 1,
        fileUrl: '/uploads/patient-photos/x.jpg',
      });
      (existsSync as jest.Mock).mockReturnValue(true);
      await service.remove(1, 5, 3);
      expect(photoRepo.delete).toHaveBeenCalledWith({ id: 3 });
      expect(unlinkSync).toHaveBeenCalled();
      expect(storageQuota.forget).toHaveBeenCalledWith('patient-photo', '/uploads/patient-photos/x.jpg');
    });
  });
});
