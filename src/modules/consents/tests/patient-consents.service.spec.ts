import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PatientConsentsService } from '../patient-consents.service';
import {
  PatientConsent,
  PatientConsentStatus,
} from '../entities/patient-consent.entity';
import { ConsentTemplate } from '../entities/consent-template.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { ConsentTemplatesService } from '../consent-templates.service';
import { ConsentSignerRole } from '../dto/patient-consent.dto';

function buildQb(result: [any[], number] = [[], 0]) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
  };
}

describe('PatientConsentsService', () => {
  let service: PatientConsentsService;
  let consentRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let patientRepo: { findOne: jest.Mock };
  let templatesService: { findAll: jest.Mock; findByTarif: jest.Mock };

  beforeEach(async () => {
    consentRepo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
    };
    patientRepo = { findOne: jest.fn() };
    templatesService = { findAll: jest.fn(), findByTarif: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientConsentsService,
        { provide: getRepositoryToken(PatientConsent), useValue: consentRepo },
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: ConsentTemplatesService, useValue: templatesService },
      ],
    }).compile();

    service = module.get<PatientConsentsService>(PatientConsentsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findOne', () => {
    it('returns the consent when found (positive)', async () => {
      consentRepo.findOne.mockResolvedValue({ id: 1 });
      const result = await service.findOne(1, 1);
      expect(result).toEqual({ id: 1 });
    });

    it('throws NotFoundException when missing (negative)', async () => {
      consentRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const dto = { patientId: 3, tarifId: 5 } as any;

    it('creates a DRAFT consent from a tarif-linked template (positive)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 3, clinicId: 1 });
      templatesService.findByTarif.mockResolvedValue({
        id: 10,
        tarifId: 5,
        title: 'T',
        content: 'C',
      });

      const result = await service.create(1, dto, 9);

      expect(consentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PatientConsentStatus.DRAFT,
          templateId: 10,
          createdBy: 9,
        }),
      );
      expect(result.status).toBe(PatientConsentStatus.DRAFT);
    });

    it('resolves template by templateId when explicitly provided (positive)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 3, clinicId: 1 });
      templatesService.findAll.mockResolvedValue([
        { id: 10, tarifId: 5, title: 'T', content: 'C' },
        { id: 11, tarifId: 6, title: 'T2', content: 'C2' },
      ]);

      await service.create(1, { patientId: 3, templateId: 11 } as any, 9);

      expect(consentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: 11 }),
      );
    });

    it('throws NotFoundException when patient does not exist (negative)', async () => {
      patientRepo.findOne.mockResolvedValue(null);
      await expect(service.create(1, dto, 9)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when no template is configured (negative)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 3, clinicId: 1 });
      templatesService.findByTarif.mockResolvedValue(null);
      await expect(service.create(1, dto, 9)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('sign', () => {
    it('records patient signature and marks PARTIAL when doctor has not signed (positive)', async () => {
      consentRepo.findOne.mockResolvedValue({
        id: 1,
        patient: { name: 'Budi' },
        patientSignature: null,
        doctorSignature: null,
      });

      const result = await service.sign(
        1,
        1,
        { role: ConsentSignerRole.PATIENT, signatureDataUrl: 'data:img' } as any,
        9,
      );

      expect(result.status).toBe(PatientConsentStatus.PARTIAL);
      expect(result.patientSignerName).toBe('Budi');
    });

    it('marks COMPLETED once both patient and doctor signatures are present (positive)', async () => {
      consentRepo.findOne.mockResolvedValue({
        id: 1,
        patient: { name: 'Budi' },
        patientSignature: 'data:existing-patient-sig',
        doctorSignature: null,
      });

      const result = await service.sign(
        1,
        1,
        { role: ConsentSignerRole.DOCTOR, signatureDataUrl: 'data:doc-sig' } as any,
        9,
      );

      expect(result.status).toBe(PatientConsentStatus.COMPLETED);
      expect(result.doctorSignedBy).toBe(9);
    });

    it('uses the provided signerName over the patient name when given (positive/edge)', async () => {
      consentRepo.findOne.mockResolvedValue({
        id: 1,
        patient: { name: 'Budi' },
        patientSignature: null,
        doctorSignature: null,
      });

      const result = await service.sign(
        1,
        1,
        {
          role: ConsentSignerRole.PATIENT,
          signatureDataUrl: 'data:img',
          signerName: 'Wali Budi',
        } as any,
        9,
      );

      expect(result.patientSignerName).toBe('Wali Budi');
    });

    it('throws NotFoundException when consent does not exist (negative)', async () => {
      consentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.sign(999, 1, { role: ConsentSignerRole.PATIENT } as any, 9),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('scopes to clinic and applies filters (positive)', async () => {
      const qb = buildQb();
      consentRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(1, { patientId: 3, status: PatientConsentStatus.DRAFT } as any);

      expect(qb.where).toHaveBeenCalledWith('c.clinicId = :clinicId', {
        clinicId: 1,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('c.patientId = :patientId', {
        patientId: 3,
      });
    });
  });
});
