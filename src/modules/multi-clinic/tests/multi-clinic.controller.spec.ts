import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { MultiClinicController } from '../multi-clinic.controller';
import { MultiClinicService } from '../multi-clinic.service';
import { ClinicsService } from '../../clinics/clinics.service';

describe('MultiClinicController', () => {
  let controller: MultiClinicController;
  let multiClinicService: {
    assertOwnsClinic: jest.Mock;
    getMyClinics: jest.Mock;
    getDashboard: jest.Mock;
    listOwners: jest.Mock;
    linkClinic: jest.Mock;
    unlinkClinic: jest.Mock;
  };
  let clinicsService: {
    findOne: jest.Mock;
    update: jest.Mock;
    uploadLogo: jest.Mock;
  };

  const user = { userId: 5 };

  beforeEach(async () => {
    multiClinicService = {
      assertOwnsClinic: jest.fn().mockResolvedValue(undefined),
      getMyClinics: jest.fn(),
      getDashboard: jest.fn(),
      listOwners: jest.fn(),
      linkClinic: jest.fn(),
      unlinkClinic: jest.fn(),
    };
    clinicsService = {
      findOne: jest.fn(),
      update: jest.fn(),
      uploadLogo: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MultiClinicController],
      providers: [
        { provide: MultiClinicService, useValue: multiClinicService },
        { provide: ClinicsService, useValue: clinicsService },
      ],
    }).compile();

    controller = module.get<MultiClinicController>(MultiClinicController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('getClinic', () => {
    it('returns the clinic after confirming ownership (positive)', async () => {
      clinicsService.findOne.mockResolvedValue({ id: 10, name: 'Klinik A' });

      const result = await controller.getClinic(10, user);

      expect(multiClinicService.assertOwnsClinic).toHaveBeenCalledWith(5, 10);
      expect(result).toEqual({ id: 10, name: 'Klinik A' });
    });

    it('propagates the ForbiddenException without ever calling clinicsService when the clinic is not owned (negative)', async () => {
      multiClinicService.assertOwnsClinic.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(controller.getClinic(999, user)).rejects.toThrow(
        ForbiddenException,
      );
      expect(clinicsService.findOne).not.toHaveBeenCalled();
    });
  });

  describe('updateClinic', () => {
    it('updates the clinic after confirming ownership (positive)', async () => {
      const dto = { name: 'Nama Baru' } as any;
      clinicsService.update.mockResolvedValue({ id: 10, name: 'Nama Baru' });

      const result = await controller.updateClinic(10, dto, user);

      expect(multiClinicService.assertOwnsClinic).toHaveBeenCalledWith(5, 10);
      expect(clinicsService.update).toHaveBeenCalledWith(10, dto, 5);
      expect(result).toEqual({ id: 10, name: 'Nama Baru' });
    });

    it('never touches the clinic when ownership fails (negative)', async () => {
      multiClinicService.assertOwnsClinic.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        controller.updateClinic(999, {} as any, user),
      ).rejects.toThrow(ForbiddenException);
      expect(clinicsService.update).not.toHaveBeenCalled();
    });
  });

  describe('uploadClinicLogo', () => {
    const file = { buffer: Buffer.from('img') } as Express.Multer.File;

    it('uploads the logo after confirming ownership (positive)', async () => {
      clinicsService.uploadLogo.mockResolvedValue({ logoUrl: 'https://x/logo.png' });

      const result = await controller.uploadClinicLogo(10, file, user);

      expect(multiClinicService.assertOwnsClinic).toHaveBeenCalledWith(5, 10);
      expect(clinicsService.uploadLogo).toHaveBeenCalledWith(10, file);
      expect(result).toEqual({ logoUrl: 'https://x/logo.png' });
    });

    it('never uploads when the clinic is not owned by this account (negative)', async () => {
      multiClinicService.assertOwnsClinic.mockRejectedValue(
        new ForbiddenException(),
      );

      await expect(
        controller.uploadClinicLogo(999, file, user),
      ).rejects.toThrow(ForbiddenException);
      expect(clinicsService.uploadLogo).not.toHaveBeenCalled();
    });
  });
});
