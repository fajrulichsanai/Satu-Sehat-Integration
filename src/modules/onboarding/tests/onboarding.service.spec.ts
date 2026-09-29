import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OnboardingService } from '../onboarding.service';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Tarif } from '../../tarif/entities/tarif.entity';
import { Practitioner } from '../../practitioners/entities/practitioner.entity';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let clinicRepo: { findOne: jest.Mock };
  let tarifRepo: { count: jest.Mock };
  let practitionerRepo: { count: jest.Mock };

  beforeEach(async () => {
    clinicRepo = { findOne: jest.fn() };
    tarifRepo = { count: jest.fn() };
    practitionerRepo = { count: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: getRepositoryToken(Clinic), useValue: clinicRepo },
        { provide: getRepositoryToken(Tarif), useValue: tarifRepo },
        { provide: getRepositoryToken(Practitioner), useValue: practitionerRepo },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  it('reports allComplete=true only when all three steps are done (positive)', async () => {
    clinicRepo.findOne.mockResolvedValue({ setupComplete: true });
    tarifRepo.count.mockResolvedValue(3);
    practitionerRepo.count.mockResolvedValue(2);

    const result = await service.getStatus(1);

    expect(result.data.allComplete).toBe(true);
    expect(result.data.tarif).toEqual({ complete: true, count: 3 });
  });

  it('reports allComplete=false when clinic profile setup is incomplete (negative)', async () => {
    clinicRepo.findOne.mockResolvedValue({ setupComplete: false });
    tarifRepo.count.mockResolvedValue(3);
    practitionerRepo.count.mockResolvedValue(2);

    const result = await service.getStatus(1);

    expect(result.data.allComplete).toBe(false);
    expect(result.data.infoKlinik.complete).toBe(false);
  });

  it('reports allComplete=false when there are no active tarifs (negative)', async () => {
    clinicRepo.findOne.mockResolvedValue({ setupComplete: true });
    tarifRepo.count.mockResolvedValue(0);
    practitionerRepo.count.mockResolvedValue(2);

    const result = await service.getStatus(1);

    expect(result.data.allComplete).toBe(false);
    expect(result.data.tarif.complete).toBe(false);
  });

  it('reports allComplete=false when there are no active practitioners (negative)', async () => {
    clinicRepo.findOne.mockResolvedValue({ setupComplete: true });
    tarifRepo.count.mockResolvedValue(1);
    practitionerRepo.count.mockResolvedValue(0);

    const result = await service.getStatus(1);

    expect(result.data.allComplete).toBe(false);
    expect(result.data.dokter.complete).toBe(false);
  });

  it('treats a missing clinic as incomplete rather than throwing (negative/edge)', async () => {
    clinicRepo.findOne.mockResolvedValue(null);
    tarifRepo.count.mockResolvedValue(0);
    practitionerRepo.count.mockResolvedValue(0);

    const result = await service.getStatus(999);

    expect(result.data.infoKlinik.complete).toBe(false);
    expect(result.data.allComplete).toBe(false);
  });
});
