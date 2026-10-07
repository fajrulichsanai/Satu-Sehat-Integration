import { SyncOrchestratorService } from '../sync/sync-orchestrator.service';

/**
 * Alur lengkap diuji end-to-end terhadap database sungguhan dengan SATUSEHAT
 * tiruan; di sini dicakup jalur awal yang tidak butuh data klinis.
 */
describe('SyncOrchestratorService', () => {
  const repo = () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
  });
  let clinicRepo: ReturnType<typeof repo>;
  let encounterRepo: ReturnType<typeof repo>;
  let conditionRepo: ReturnType<typeof repo>;
  let observationRepo: ReturnType<typeof repo>;
  let service: SyncOrchestratorService;

  beforeEach(() => {
    clinicRepo = repo();
    encounterRepo = repo();
    conditionRepo = repo();
    observationRepo = repo();
    const others = Array.from({ length: 11 }, repo);
    service = new (SyncOrchestratorService as any)(
      encounterRepo,
      others[0], // patient
      clinicRepo,
      ...others.slice(1),
      {} as any, // SatusehatClientService
      {} as any, // KfaService
      repo(), // ToothCondition
      repo(), // DentalBridge
      repo(), // PatientRecall
      repo(), // LabOrder
      repo(), // RadiologyOrder
      {} as any, // ClinicalCatalogService
      repo(), // PrescriptionReview
      repo(), // SatusehatOrganization
      conditionRepo,
      observationRepo,
    );
  });

  it('refuses to send when the clinic has no SATUSEHAT configuration (negative)', async () => {
    clinicRepo.findOne.mockResolvedValue({ id: 1, satusehatOrgId: null });
    const result = await service.syncEncounterFull(5, 1);
    expect(result.success).toBe(false);
    expect(result.steps[0].message).toContain('Kredensial SATUSEHAT');
    expect(encounterRepo.findOne).not.toHaveBeenCalled();
  });

  it('skips a cancelled encounter that was never sent (edge)', async () => {
    clinicRepo.findOne.mockResolvedValue({
      id: 1,
      satusehatOrgId: '100',
      satusehatClientId: 'c',
      satusehatClientSecret: 's',
    });
    encounterRepo.findOne.mockResolvedValue({
      id: 5,
      status: 'cancelled',
      satusehatEncounterId: null,
    });
    const result = await service.syncEncounterFull(5, 1);
    expect(result).toEqual({
      success: true,
      steps: [
        expect.objectContaining({
          status: 'skipped',
          resourceType: 'Encounter',
        }),
      ],
    });
  });

  it('background auto-sync does nothing for an unconfigured clinic (negative)', async () => {
    clinicRepo.findOne.mockResolvedValue({ id: 1 });
    await service.syncEncounterInBackground(5, 1);
    expect(encounterRepo.findOne).not.toHaveBeenCalled();
  });

  describe('Kondisi & Observasi', () => {
    const ctx = {
      orgId: '100',
      patient: { id: 'P1', name: 'Pasien' },
      practitioner: { id: 'N1', name: 'dr. A' },
      location: { id: 'L1', name: 'Poli' },
      encounterId: 'ENC-B',
    };
    const encounter = { id: 20, patientId: 7 } as any;
    const ok = (localType: string, id: string) => ({
      step: 'x',
      resourceType: 'Condition',
      localType,
      localId: 1,
      status: 'success',
      satusehatId: id,
    });

    it('keeps the original encounter reference and records the sync result (positive)', async () => {
      conditionRepo.find.mockResolvedValue([
        {
          id: 1,
          encounterId: 10,
          lastEncounterId: 20,
          codeSystem: 'icd10',
          code: 'I10',
          display: 'Essential (primary) hypertension',
          clinicalStatus: 'active',
          verificationStatus: 'confirmed',
          createdAt: new Date('2025-01-01T03:00:00Z'),
          satusehatId: null,
        },
      ]);
      encounterRepo.findOne.mockResolvedValue({
        id: 10,
        satusehatEncounterId: 'ENC-A',
      });
      const send = jest
        .spyOn(service as any, 'sendLinked')
        .mockResolvedValue(ok('cond_problem', 'COND-1'));
      const r = await (service as any).syncProblemList(1, encounter, ctx);
      expect((send.mock.calls[0] as any[])[2].resource.encounter).toEqual({
        reference: 'Encounter/ENC-A',
      });
      expect(conditionRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          syncStatus: 'synced',
          satusehatId: 'COND-1',
        }),
      );
      expect(r.removed).toHaveLength(0);
    });

    it('sends a removal once and never sends one that was never sent (edge)', async () => {
      const base = {
        encounterId: 20,
        lastEncounterId: 20,
        codeSystem: 'icd10',
        code: 'E11',
        display: 'DM',
        clinicalStatus: 'active',
        verificationStatus: 'entered-in-error',
        createdAt: new Date(),
      };
      conditionRepo.find.mockResolvedValue([
        { ...base, id: 1, satusehatId: null, syncStatus: 'pending' },
        { ...base, id: 2, satusehatId: 'C2', syncStatus: 'synced' },
        { ...base, id: 3, satusehatId: 'C3', syncStatus: 'pending' },
      ]);
      const send = jest
        .spyOn(service as any, 'sendLinked')
        .mockResolvedValue(ok('cond_problem', 'C3'));
      const r = await (service as any).syncProblemList(1, encounter, ctx);
      expect(send).toHaveBeenCalledTimes(1);
      expect((send.mock.calls[0] as any[])[2].localId).toBe(3);
      expect(
        (send.mock.calls[0] as any[])[2].resource.clinicalStatus,
      ).toBeUndefined();
      expect(r.removed).toHaveLength(1);
    });

    it('marks an observation failed with a readable reason when SATUSEHAT rejects it (negative)', async () => {
      observationRepo.find.mockResolvedValue([
        {
          id: 9,
          observationKey: 'bmi',
          valueNumber: 24.2,
          effectiveAt: new Date('2025-01-01T03:00:00Z'),
          status: 'final',
        },
      ]);
      jest.spyOn(service as any, 'sendLinked').mockResolvedValue({
        step: '04. Observasi',
        resourceType: 'Observation',
        localType: 'clin_obs_vital-signs',
        localId: 9,
        status: 'failed',
        message: 'HTTP 400: code invalid',
      });
      await (service as any).syncObservations(1, encounter, ctx);
      expect(observationRepo.update).toHaveBeenCalledWith(
        9,
        expect.objectContaining({
          syncStatus: 'failed',
          syncError: 'HTTP 400: code invalid',
        }),
      );
    });
  });
});
