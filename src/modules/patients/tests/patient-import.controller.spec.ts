import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PatientImportController } from '../patient-import.controller';
import { PatientImportService } from '../patient-import.service';

describe('PatientImportController', () => {
  let controller: PatientImportController;
  let service: {
    generateTemplateBuffer: jest.Mock;
    parseFile: jest.Mock;
    importRows: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      generateTemplateBuffer: jest.fn().mockReturnValue(Buffer.from('xlsx-bytes')),
      parseFile: jest.fn(),
      importRows: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PatientImportController],
      providers: [{ provide: PatientImportService, useValue: service }],
    }).compile();

    controller = module.get<PatientImportController>(PatientImportController);
  });

  it('should be defined', () => expect(controller).toBeDefined());

  describe('downloadTemplate', () => {
    it('streams the generated buffer as an xlsx attachment (positive)', async () => {
      const res = { set: jest.fn(), send: jest.fn() } as any;

      await controller.downloadTemplate(res);

      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': expect.stringContaining('template-migrasi-pasien.xlsx'),
        }),
      );
      expect(res.send).toHaveBeenCalledWith(Buffer.from('xlsx-bytes'));
    });
  });

  describe('importPatients', () => {
    const file = { buffer: Buffer.from('fake') } as Express.Multer.File;

    it('parses the uploaded file and imports it for the given clinicId (positive)', async () => {
      service.parseFile.mockReturnValue([{ name: 'Budi', gender: 'Laki-laki' }]);
      service.importRows.mockResolvedValue({ totalRows: 1, created: 1, failed: 0, results: [] });

      const result = await controller.importPatients(file, 7);

      expect(service.parseFile).toHaveBeenCalledWith(file.buffer);
      expect(service.importRows).toHaveBeenCalledWith(7, [{ name: 'Budi', gender: 'Laki-laki' }]);
      expect(result).toEqual({
        success: true,
        data: { totalRows: 1, created: 1, failed: 0, results: [] },
      });
    });

    it('rejects with no upload attempted when no file is provided (negative)', async () => {
      await expect(controller.importPatients(undefined as any, 7)).rejects.toThrow(BadRequestException);
      expect(service.parseFile).not.toHaveBeenCalled();
    });

    it('rejects without importing when the parsed file has no data rows (negative)', async () => {
      service.parseFile.mockReturnValue([]);

      await expect(controller.importPatients(file, 7)).rejects.toThrow(BadRequestException);
      expect(service.importRows).not.toHaveBeenCalled();
    });
  });
});
