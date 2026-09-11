import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PatientsService } from '../patients.service';
import { Patient } from '../entities/patient.entity';
import { Encounter } from '../../encounters/entities/encounter.entity';
import { EncounterSoapNote } from '../../encounter-soap-notes/entities/encounter-soap-note.entity';
import { PhysicalExamination } from '../../physical-examination/entities/physical-examination.entity';
import { DentalExamination } from '../../dental-examination/entities/dental-examination.entity';
import { PrescriptionItem } from '../../prescriptions/entities/prescription-item.entity';
import { Billing } from '../../billing/entities/billing.entity';
import {
  SupportingExamImage,
  SupportingExamImageType,
} from '../../supporting-exam/entities/supporting-exam-image.entity';
import { PatientRecall } from '../../recalls/entities/patient-recall.entity';
import { SatusehatClientService } from '../../satusehat/satusehat-client.service';
import { TreatmentPlansService } from '../../treatment-plans/treatment-plans.service';

function buildQb(overrides: Partial<Record<string, any>> = {}) {
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getRawMany: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
  return qb;
}

describe('PatientsService', () => {
  let service: PatientsService;
  let patientRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
  };
  let encounterRepo: { find: jest.Mock };
  let soapRepo: { find: jest.Mock };
  let physicalExamRepo: { find: jest.Mock };
  let dentalExamRepo: { find: jest.Mock };
  let prescriptionRepo: { find: jest.Mock };
  let billingRepo: { find: jest.Mock };
  let imageRepo: { find: jest.Mock };
  let recallRepo: { find: jest.Mock };
  let dataSource: { transaction: jest.Mock; query: jest.Mock };
  let satusehatClient: { searchPatientByNik: jest.Mock };
  let treatmentPlansService: { findByPatient: jest.Mock };
  let manager: { create: jest.Mock; save: jest.Mock; query: jest.Mock };

  const clinicId = 1;

  beforeEach(async () => {
    manager = {
      create: jest.fn((entity, data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      query: jest.fn().mockResolvedValue([]),
    };
    patientRepo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      save: jest.fn((data) => Promise.resolve(data)),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    encounterRepo = { find: jest.fn().mockResolvedValue([]) };
    soapRepo = { find: jest.fn().mockResolvedValue([]) };
    physicalExamRepo = { find: jest.fn().mockResolvedValue([]) };
    dentalExamRepo = { find: jest.fn().mockResolvedValue([]) };
    prescriptionRepo = { find: jest.fn().mockResolvedValue([]) };
    billingRepo = { find: jest.fn().mockResolvedValue([]) };
    imageRepo = { find: jest.fn().mockResolvedValue([]) };
    recallRepo = { find: jest.fn().mockResolvedValue([]) };
    dataSource = {
      transaction: jest.fn((cb: any) => cb(manager)),
      query: jest.fn().mockResolvedValue([{ total: '0' }]),
    };
    satusehatClient = { searchPatientByNik: jest.fn() };
    treatmentPlansService = { findByPatient: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientsService,
        { provide: getRepositoryToken(Patient), useValue: patientRepo },
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
        { provide: getRepositoryToken(EncounterSoapNote), useValue: soapRepo },
        { provide: getRepositoryToken(PhysicalExamination), useValue: physicalExamRepo },
        { provide: getRepositoryToken(DentalExamination), useValue: dentalExamRepo },
        { provide: getRepositoryToken(PrescriptionItem), useValue: prescriptionRepo },
        { provide: getRepositoryToken(Billing), useValue: billingRepo },
        { provide: getRepositoryToken(SupportingExamImage), useValue: imageRepo },
        { provide: getRepositoryToken(PatientRecall), useValue: recallRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: SatusehatClientService, useValue: satusehatClient },
        { provide: TreatmentPlansService, useValue: treatmentPlansService },
      ],
    }).compile();

    service = module.get<PatientsService>(PatientsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findAll', () => {
    it('scopes to clinic and falls back to createdAt for an invalid sort column (positive/edge)', async () => {
      const qb = buildQb();
      patientRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(clinicId, {
        page: 1,
        limit: 10,
        sortBy: 'p.maliciousColumn',
        sortOrder: 'ASC',
      } as any);

      expect(qb.orderBy).toHaveBeenCalledWith('p.createdAt', 'ASC');
    });

    it('uses an explicit valid sort column when given (positive)', async () => {
      const qb = buildQb();
      patientRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(clinicId, {
        page: 1,
        limit: 10,
        sortBy: 'p.name',
        sortOrder: 'ASC',
      } as any);

      expect(qb.orderBy).toHaveBeenCalledWith('p.name', 'ASC');
    });

    it('applies a search filter across name/noRm/nik (positive)', async () => {
      const qb = buildQb();
      patientRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(clinicId, {
        page: 1,
        limit: 10,
        search: 'Budi',
      } as any);

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('p.name LIKE'),
        { search: '%Budi%', nik: 'Budi' },
      );
    });
  });

  describe('findOne', () => {
    it('returns the patient when found (positive)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId });
      const result = await service.findOne(1, clinicId);
      expect(result).toEqual({ id: 1, clinicId });
    });

    it('throws NotFoundException when missing (negative)', async () => {
      patientRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, clinicId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    const dto = { name: 'Budi', nik: '1234567890123456' } as any;

    it('creates a patient with a sequential noRm (positive)', async () => {
      patientRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getOne: jest.fn().mockResolvedValue(null) }),
      );
      manager.query.mockResolvedValue([{ no_rm: '000005' }]);

      const result = await service.create(clinicId, dto);

      expect(result.noRm).toBe('000006');
    });

    it('starts numbering at 000001 when the clinic has no patients yet (positive/edge)', async () => {
      patientRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getOne: jest.fn().mockResolvedValue(null) }),
      );
      manager.query.mockResolvedValue([]);

      const result = await service.create(clinicId, dto);

      expect(result.noRm).toBe('000001');
    });

    it('throws ConflictException for a duplicate NIK within the clinic (negative)', async () => {
      patientRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getOne: jest.fn().mockResolvedValue({ id: 5 }) }),
      );
      await expect(service.create(clinicId, dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('retries noRm generation on a duplicate-entry race and eventually succeeds (positive/edge)', async () => {
      patientRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getOne: jest.fn().mockResolvedValue(null) }),
      );
      manager.query.mockResolvedValue([]);

      const dupError = Object.assign(
        new QueryFailedError('insert', [], new Error('dup') as any),
        { code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry '000001' for key 'no_rm'" },
      );
      manager.save.mockRejectedValueOnce(dupError).mockResolvedValueOnce({
        id: 1,
        noRm: '000002',
      });

      const result = await service.create(clinicId, dto);
      expect(result.noRm).toBe('000002');
      expect(manager.save).toHaveBeenCalledTimes(2);
    });

    it('gives up after 5 attempts on persistent noRm collisions (negative/edge)', async () => {
      patientRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getOne: jest.fn().mockResolvedValue(null) }),
      );
      manager.query.mockResolvedValue([]);
      const dupError = Object.assign(
        new QueryFailedError('insert', [], new Error('dup') as any),
        { code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry for key 'no_rm'" },
      );
      manager.save.mockRejectedValue(dupError);

      await expect(service.create(clinicId, dto)).rejects.toThrow();
      expect(manager.save).toHaveBeenCalledTimes(5);
    });

    it('uses the given noRmOverride verbatim instead of generating one, for data migration (positive)', async () => {
      patientRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getOne: jest.fn().mockResolvedValue(null) }),
      );

      const result = await service.create(clinicId, dto, 'LEGACY-0042');

      expect(result.noRm).toBe('LEGACY-0042');
      expect(manager.query).not.toHaveBeenCalled(); // generateNoRm's SELECT is skipped entirely
    });

    it('throws a clear ConflictException, without retrying, when the noRmOverride is already taken (negative)', async () => {
      patientRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getOne: jest.fn().mockResolvedValue(null) }),
      );
      const dupError = Object.assign(
        new QueryFailedError('insert', [], new Error('dup') as any),
        { code: 'ER_DUP_ENTRY', sqlMessage: "Duplicate entry 'LEGACY-0042' for key 'no_rm'" },
      );
      manager.save.mockRejectedValue(dupError);

      await expect(
        service.create(clinicId, dto, 'LEGACY-0042'),
      ).rejects.toThrow(ConflictException);
      // Never silently picks a different number instead of the one the caller asked for.
      expect(manager.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('merges fields and re-checks NIK uniqueness only when NIK changes (positive)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId, nik: 'OLD', name: 'A' });
      const qb = buildQb({ getOne: jest.fn().mockResolvedValue(null) });
      patientRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.update(1, clinicId, { name: 'B' } as any);

      expect(result.name).toBe('B');
      expect(patientRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the new NIK is already used by another patient (negative)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId, nik: 'OLD' });
      patientRepo.createQueryBuilder.mockReturnValue(
        buildQb({ getOne: jest.fn().mockResolvedValue({ id: 2 }) }),
      );
      await expect(
        service.update(1, clinicId, { nik: 'NEW' } as any),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('removes a patient with no history (positive)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId });
      dataSource.query.mockResolvedValue([{ total: '0' }]);
      await expect(service.remove(1, clinicId)).resolves.toBeUndefined();
      expect(patientRepo.remove).toHaveBeenCalled();
    });

    it('throws ConflictException when the patient has encounters (negative)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId });
      dataSource.query
        .mockResolvedValueOnce([{ total: '3' }])
        .mockResolvedValueOnce([{ total: '0' }]);
      await expect(service.remove(1, clinicId)).rejects.toThrow(
        ConflictException,
      );
      expect(patientRepo.remove).not.toHaveBeenCalled();
    });

    it('throws ConflictException when the patient has billings (negative)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId });
      dataSource.query
        .mockResolvedValueOnce([{ total: '0' }])
        .mockResolvedValueOnce([{ total: '1' }]);
      await expect(service.remove(1, clinicId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('translates a QueryFailedError from remove() into ConflictException (negative/edge)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId });
      dataSource.query.mockResolvedValue([{ total: '0' }]);
      patientRepo.remove.mockRejectedValue(
        new QueryFailedError('delete', [], new Error('fk') as any),
      );
      await expect(service.remove(1, clinicId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('searchSatusehat', () => {
    it('delegates to the SATUSEHAT client with a NIK (positive)', async () => {
      satusehatClient.searchPatientByNik.mockResolvedValue({ found: true });
      const result = await service.searchSatusehat('1234567890123456', clinicId);
      expect(result).toEqual({ found: true });
    });

    it('throws BadRequestException when NIK is empty (negative)', async () => {
      await expect(service.searchSatusehat('', clinicId)).rejects.toThrow(
        BadRequestException,
      );
      expect(satusehatClient.searchPatientByNik).not.toHaveBeenCalled();
    });
  });

  describe('getTimeline', () => {
    it('merges encounters, billings, photos, recalls and treatment plans sorted by date desc (positive)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId });
      encounterRepo.find.mockResolvedValue([
        {
          id: 1,
          arrivedTime: new Date('2026-01-01T00:00:00Z'),
          finishedTime: new Date('2026-01-01T01:00:00Z'),
          chiefComplaint: 'Sakit gigi',
          status: 'finished',
          practitioner: { name: 'A' },
        },
      ]);
      billingRepo.find.mockResolvedValue([
        {
          id: 1,
          encounterId: 1,
          invoiceNumber: 'INV-1',
          grandTotal: 100000,
          status: 'paid',
          createdAt: new Date('2026-01-02T00:00:00Z'),
          items: [{ name: 'Tambal' }],
        },
      ]);
      imageRepo.find.mockResolvedValue([
        {
          id: 1,
          encounterId: 1,
          category: null,
          imageType: SupportingExamImageType.XRAY,
          createdAt: new Date('2026-01-03T00:00:00Z'),
          fileUrl: 'url',
        },
      ]);
      recallRepo.find.mockResolvedValue([
        {
          id: 1,
          dueDate: '2026-02-01',
          status: 'pending',
          tarif: { name: 'Kontrol' },
        },
      ]);
      treatmentPlansService.findByPatient.mockResolvedValue([
        {
          id: 1,
          label: 'Ortho',
          treatmentType: 'ortho',
          status: 'active',
          currentStage: 1,
          totalStages: 3,
          createdAt: new Date('2026-01-04T00:00:00Z'),
        },
      ]);

      const result = await service.getTimeline(1, clinicId);

      expect(result).toHaveLength(5);
      // sorted descending by date -> recall (2026-02-01) should be first
      expect(result[0].type).toBe('recall');
    });

    it('returns an empty timeline for a patient with no activity (negative/edge)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId });
      const result = await service.getTimeline(1, clinicId);
      expect(result).toEqual([]);
    });

    it('skips soap-note and photo lookups when the patient has no encounters (edge)', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 1, clinicId });
      encounterRepo.find.mockResolvedValue([]);
      await service.getTimeline(1, clinicId);
      expect(soapRepo.find).not.toHaveBeenCalled();
      expect(imageRepo.find).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the patient does not exist (negative)', async () => {
      patientRepo.findOne.mockResolvedValue(null);
      await expect(service.getTimeline(999, clinicId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getReferralSummary', () => {
    it('parses count strings into numbers for both breakdowns (positive)', async () => {
      const bySourceQb = buildQb({
        getRawMany: jest.fn().mockResolvedValue([
          { sumberInformasi: 'instagram', count: '5' },
        ]),
      });
      const byReferrerQb = buildQb({
        getRawMany: jest.fn().mockResolvedValue([
          { referrerPatientId: 3, referrerName: 'Budi', referralCount: '2' },
        ]),
      });
      patientRepo.createQueryBuilder
        .mockReturnValueOnce(bySourceQb)
        .mockReturnValueOnce(byReferrerQb);

      const result = await service.getReferralSummary(clinicId);

      expect(result.bySource[0].count).toBe(5);
      expect(result.byReferrer[0].referralCount).toBe(2);
    });
  });
});
