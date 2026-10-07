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
  let service: SyncOrchestratorService;

  beforeEach(() => {
    clinicRepo = repo();
    encounterRepo = repo();
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
});
