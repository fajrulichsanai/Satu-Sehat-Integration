import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClinicalRecordsService } from '../clinical-records.service';

const OWNER = { userId: 9, role: 'owner' };

describe('ClinicalRecordsService', () => {
  const repo = () => ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn((d) => Promise.resolve({ id: 1, ...d })),
    delete: jest.fn(),
    query: jest.fn().mockResolvedValue([]),
  });
  let conditionRepo: ReturnType<typeof repo>;
  let observationRepo: ReturnType<typeof repo>;
  let encounterRepo: ReturnType<typeof repo>;
  let terminology: { resolve: jest.Mock; nameIdFor: jest.Mock };
  let sync: { syncEncounterFull: jest.Mock };
  let service: ClinicalRecordsService;

  beforeEach(() => {
    conditionRepo = repo();
    observationRepo = repo();
    encounterRepo = repo();
    encounterRepo.findOne.mockResolvedValue({
      id: 5,
      clinicId: 1,
      patientId: 7,
      satusehatEncounterId: 'ENC',
    });
    terminology = {
      resolve: jest.fn(
        async (items) =>
          new Map(
            items.map((i: any) => [
              `${i.system}:${i.code}`,
              { display: 'Essential (primary) hypertension' },
            ]),
          ),
      ),
      nameIdFor: jest.fn().mockReturnValue('Hipertensi'),
    };
    sync = { syncEncounterFull: jest.fn() };
    service = new ClinicalRecordsService(
      conditionRepo as any,
      observationRepo as any,
      encounterRepo as any,
      terminology as any,
      sync as any,
    );
  });

  describe('createCondition', () => {
    it('stores the code system name and defaults to active + confirmed (positive)', async () => {
      const c = await service.createCondition(
        5,
        1,
        { system: 'icd10', code: ' i10 ' },
        OWNER,
      );
      expect(terminology.resolve).toHaveBeenCalledWith([
        { system: 'icd10', code: 'I10' },
      ]);
      expect(c).toMatchObject({
        patientId: 7,
        encounterId: 5,
        lastEncounterId: 5,
        code: 'I10',
        display: 'Essential (primary) hypertension',
        nameId: 'Hipertensi',
        clinicalStatus: 'active',
        verificationStatus: 'confirmed',
        abatementDate: null,
        syncStatus: 'pending',
      });
    });

    it('rejects an active duplicate of the same code (negative)', async () => {
      conditionRepo.find.mockResolvedValue([{ clinicalStatus: 'active' }]);
      await expect(
        service.createCondition(5, 1, { system: 'icd10', code: 'I10' }, OWNER),
      ).rejects.toThrow(ConflictException);
    });

    it('rejects abatement on an active condition, future dates and abatement before onset (negative)', async () => {
      await expect(
        service.createCondition(
          5,
          1,
          { system: 'icd10', code: 'I10', abatementDate: '2024-01-01' },
          OWNER,
        ),
      ).rejects.toThrow('hanya diisi');
      await expect(
        service.createCondition(
          5,
          1,
          { system: 'icd10', code: 'I10', onsetDate: '2999-01-01' },
          OWNER,
        ),
      ).rejects.toThrow('masa depan');
      await expect(
        service.createCondition(
          5,
          1,
          {
            system: 'icd10',
            code: 'I10',
            clinicalStatus: 'resolved',
            onsetDate: '2024-05-01',
            abatementDate: '2024-04-01',
          },
          OWNER,
        ),
      ).rejects.toThrow('sebelum tanggal mulai');
      await expect(
        service.createCondition(
          5,
          1,
          { system: 'icd10', code: 'I10', onsetDate: '2024-02-30' },
          OWNER,
        ),
      ).rejects.toThrow('tidak valid');
    });
  });

  describe('updateCondition', () => {
    const stored = () => ({
      id: 3,
      clinicId: 1,
      patientId: 7,
      encounterId: 2,
      lastEncounterId: 2,
      clinicalStatus: 'active',
      verificationStatus: 'confirmed',
      severity: null,
      onsetDate: '2024-01-01',
      abatementDate: null,
      note: null,
      satusehatId: 'C3',
      syncStatus: 'synced',
    });

    it('marks resolved with today as abatement and resends via this visit (positive)', async () => {
      conditionRepo.findOne.mockResolvedValue(stored());
      const c = await service.updateCondition(
        5,
        1,
        3,
        { clinicalStatus: 'resolved' },
        OWNER,
      );
      expect(c.clinicalStatus).toBe('resolved');
      expect(c.abatementDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(c.lastEncounterId).toBe(5);
      expect(c.syncStatus).toBe('pending');
    });

    it('clears the old abatement when reactivated (edge)', async () => {
      conditionRepo.findOne.mockResolvedValue({
        ...stored(),
        clinicalStatus: 'resolved',
        abatementDate: '2024-06-01',
      });
      const c = await service.updateCondition(
        5,
        1,
        3,
        { clinicalStatus: 'recurrence' },
        OWNER,
      );
      expect(c.abatementDate).toBeNull();
    });

    it('refuses a condition of another patient (negative)', async () => {
      conditionRepo.findOne.mockResolvedValue({ ...stored(), patientId: 99 });
      await expect(
        service.updateCondition(5, 1, 3, { note: 'x' }, OWNER),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeCondition', () => {
    it('deletes a condition that was never sent (positive)', async () => {
      conditionRepo.findOne.mockResolvedValue({
        id: 3,
        patientId: 7,
        verificationStatus: 'confirmed',
        satusehatId: null,
      });
      expect(await service.removeCondition(5, 1, 3, OWNER)).toEqual({
        removed: true,
        pendingSync: false,
      });
      expect(conditionRepo.delete).toHaveBeenCalledWith(3);
    });

    it('marks a sent condition entered-in-error instead of deleting it (edge)', async () => {
      conditionRepo.findOne.mockResolvedValue({
        id: 3,
        patientId: 7,
        verificationStatus: 'confirmed',
        satusehatId: 'C3',
      });
      expect(await service.removeCondition(5, 1, 3, OWNER)).toEqual({
        removed: true,
        pendingSync: true,
      });
      expect(conditionRepo.delete).not.toHaveBeenCalled();
      expect(conditionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          verificationStatus: 'entered-in-error',
          lastEncounterId: 5,
        }),
      );
    });
  });

  describe('observations', () => {
    it('rounds to the catalog precision and stores the value (positive)', async () => {
      const o = await service.createObservation(
        5,
        1,
        { observationKey: 'bmi', value: 24.567 },
        OWNER,
      );
      expect(o).toMatchObject({
        patientId: 7,
        encounterId: 5,
        valueNumber: 24.6,
        valueCode: null,
        status: 'final',
      });
    });

    it('rejects values outside the range, missing values and unknown answers (negative)', async () => {
      await expect(
        service.createObservation(
          5,
          1,
          { observationKey: 'gcs', value: 16 },
          OWNER,
        ),
      ).rejects.toThrow('antara 3 dan 15');
      await expect(
        service.createObservation(5, 1, { observationKey: 'bmi' }, OWNER),
      ).rejects.toThrow('wajib diisi');
      await expect(
        service.createObservation(
          5,
          1,
          { observationKey: 'smoking', valueCode: '123' },
          OWNER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a future examination time (edge)', async () => {
      await expect(
        service.createObservation(
          5,
          1,
          {
            observationKey: 'bmi',
            value: 20,
            effectiveAt: new Date(Date.now() + 3600_000).toISOString(),
          },
          OWNER,
        ),
      ).rejects.toThrow('masa depan');
    });

    it('marks a sent observation entered-in-error on delete (edge)', async () => {
      observationRepo.findOne.mockResolvedValue({
        id: 4,
        status: 'final',
        satusehatId: 'O4',
      });
      expect(await service.removeObservation(5, 1, 4, OWNER)).toEqual({
        removed: true,
        pendingSync: true,
      });
      expect(observationRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'entered-in-error' }),
      );
    });
  });

  it('send returns only prerequisite failures and condition/observation steps (positive)', async () => {
    sync.syncEncounterFull.mockResolvedValue({
      success: false,
      steps: [
        {
          step: '03. Daftar Masalah',
          localType: 'cond_problem',
          status: 'success',
        },
        { step: '04. Observasi', localType: 'clin_obs_exam', status: 'failed' },
        { step: '07. Diagnosis', localType: 'soap_dx_icd10', status: 'failed' },
      ],
    });
    const r = await service.send(5, 1, OWNER);
    expect(r).toMatchObject({ success: false, sent: 1, failed: 1 });
    expect(r.steps).toHaveLength(2);
  });

  describe('akses kunjungan', () => {
    it('lets a nurse work on her own visit (positive)', async () => {
      encounterRepo.query.mockResolvedValue([{ id: 3 }]);
      const r = await service.forEncounter(5, 1, {
        userId: 4,
        role: 'perawat',
      });
      expect(r.encounterSynced).toBe(true);
    });

    it("refuses a doctor or nurse on someone else's visit (negative)", async () => {
      encounterRepo.query.mockResolvedValue([]);
      for (const role of ['dokter', 'perawat']) {
        await expect(
          service.createObservation(
            5,
            1,
            { observationKey: 'bmi', value: 20 },
            { userId: 4, role },
          ),
        ).rejects.toThrow(ForbiddenException);
      }
    });

    it('does not check ownership for owner/admin (edge)', async () => {
      await service.forEncounter(5, 1, { userId: 1, role: 'admin' });
      expect(encounterRepo.query).not.toHaveBeenCalled();
    });
  });
});
