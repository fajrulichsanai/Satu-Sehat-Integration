import { BadRequestException } from '@nestjs/common';
import { SatusehatOnboardingService } from '../onboarding/satusehat-onboarding.service';

describe('SatusehatOnboardingService (prasyarat SATUSEHAT)', () => {
  const baseClinic = {
    id: 1,
    name: 'Klinik Pratama Sehat',
    phone: '0812',
    address: 'Jl. A',
    satusehatOrgId: 'ORG-1',
    satusehatClientId: 'cid',
    satusehatClientSecret: 'enc',
    satusehatOrgName: 'Klinik Pratama Sehat',
    satusehatSuborgId: null as string | null,
    satusehatPoliOrgId: null as string | null,
    satusehatPharmacyOrgId: null as string | null,
  };
  let clinicRepo: { findOne: jest.Mock; update: jest.Mock };
  let locationRepo: { find: jest.Mock };
  let client: { getFhir: jest.Mock; testConnection: jest.Mock };
  let orchestrator: { sendPrerequisite: jest.Mock; registerLocation: jest.Mock; practitionerIhsId: jest.Mock; patientIhsId: jest.Mock };
  let service: SatusehatOnboardingService;

  beforeEach(() => {
    clinicRepo = { findOne: jest.fn().mockResolvedValue({ ...baseClinic }), update: jest.fn() };
    locationRepo = { find: jest.fn().mockResolvedValue([]) };
    client = { getFhir: jest.fn(), testConnection: jest.fn() };
    let n = 0;
    orchestrator = {
      sendPrerequisite: jest.fn().mockImplementation(() => Promise.resolve(`NEW-${++n}`)),
      registerLocation: jest.fn().mockResolvedValue('LOC-1'),
      practitionerIhsId: jest.fn(),
      patientIhsId: jest.fn(),
    };
    service = new SatusehatOnboardingService(
      clinicRepo as any,
      locationRepo as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      { find: jest.fn().mockResolvedValue([]), count: jest.fn() } as any,
      client as any,
      orchestrator as any,
    );
  });

  it('builds sub-org → poli & apotek under it, saving their IDs (positive)', async () => {
    const res = await service.buildOrganizationStructure(1);
    expect(res).toEqual({ suborgId: 'NEW-1', poliOrgId: 'NEW-2', pharmacyOrgId: 'NEW-3' });
    const bodies = orchestrator.sendPrerequisite.mock.calls.map((c) => c[3]);
    expect(bodies.map((b) => [b.name, b.partOf.reference])).toEqual([
      ['Pelayanan Kesehatan', 'Organization/ORG-1'],
      ['Poli Rawat Jalan', 'Organization/NEW-1'],
      ['Apotek', 'Organization/NEW-1'],
    ]);
    expect(bodies[0].identifier[0].system).toBe('http://sys-ids.kemkes.go.id/organization/ORG-1');
    expect(clinicRepo.update).toHaveBeenCalledWith(1, { satusehatSuborgId: 'NEW-1', satusehatPoliOrgId: 'NEW-2', satusehatPharmacyOrgId: 'NEW-3' });
  });

  it('re-running updates existing organizations instead of creating new ones (edge)', async () => {
    clinicRepo.findOne.mockResolvedValue({ ...baseClinic, satusehatSuborgId: 'S', satusehatPoliOrgId: 'P', satusehatPharmacyOrgId: 'F' });
    await service.buildOrganizationStructure(1);
    expect(orchestrator.sendPrerequisite.mock.calls.map((c) => c[4])).toEqual(['S', 'P', 'F']);
  });

  it('verifyOrganization rejects an unknown Organization ID (negative)', async () => {
    client.getFhir.mockResolvedValue({ status: 404, data: { resourceType: 'OperationOutcome', issue: [{ details: { text: 'not found' } }] } });
    await expect(service.verifyOrganization(1)).rejects.toThrow(BadRequestException);
    client.getFhir.mockResolvedValue({ status: 200, data: { resourceType: 'Organization', id: 'ORG-1', name: 'Klinik X' } });
    await expect(service.verifyOrganization(1)).resolves.toEqual({ id: 'ORG-1', name: 'Klinik X', active: true });
  });

  it('locations need the poli organization first; unconfigured clinic is refused (negative)', async () => {
    await expect(service.registerLocations(1)).rejects.toThrow('struktur Organization');
    clinicRepo.findOne.mockResolvedValue({ ...baseClinic, satusehatClientSecret: null });
    await expect(service.matchPractitioners(1)).rejects.toThrow('Konfigurasi SATUSEHAT');
  });

  it('registers each active room and reports per-item errors (positive)', async () => {
    clinicRepo.findOne.mockResolvedValue({ ...baseClinic, satusehatPoliOrgId: 'P' });
    locationRepo.find.mockResolvedValue([{ id: 1, name: 'Poli 1' }, { id: 2, name: 'Poli 2' }]);
    orchestrator.registerLocation.mockResolvedValueOnce('LOC-1').mockRejectedValueOnce(new Error('HTTP 400'));
    const res = await service.registerLocations(1);
    expect(res.succeeded).toBe(1);
    expect(res.results[1]).toMatchObject({ name: 'Poli 2', error: 'HTTP 400' });
  });
});
