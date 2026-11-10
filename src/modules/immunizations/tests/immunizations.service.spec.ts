import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ImmunizationsService } from '../immunizations.service';

describe('ImmunizationsService', () => {
  let repo: any;
  let encounterRepo: any;
  let linkRepo: any;
  let service: ImmunizationsService;
  const dto = {
    kfaCode: '93000123',
    vaccineName: ' Vaksin HB ',
    doseNumber: 1,
    doseMl: 0.5,
  };

  beforeEach(() => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((d) => d),
      save: jest.fn(async (d) => ({ id: 1, ...d })),
      delete: jest.fn(),
      update: jest.fn(),
    };
    encounterRepo = { findOne: jest.fn(async () => ({ id: 5, patientId: 7 })) };
    linkRepo = { exists: jest.fn(async () => false) };
    service = new ImmunizationsService(repo, encounterRepo, linkRepo);
  });

  it('records a vaccine for the encounter patient (positive)', async () => {
    const r = await service.create(5, 1, dto, 9);
    expect(r).toMatchObject({
      patientId: 7,
      vaccineName: 'Vaksin HB',
      doseMl: '0.5',
      status: 'completed',
    });
  });

  it('rejects a future administration time (negative)', async () => {
    await expect(
      service.create(
        5,
        1,
        { ...dto, occurredAt: new Date(Date.now() + 3600_000).toISOString() },
        9,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('deletes an unsent entry but voids a sent one (edge)', async () => {
    repo.findOne.mockResolvedValue({ id: 3, status: 'completed' });
    expect(await service.remove(5, 1, 3, 9)).toEqual({
      removed: true,
      pendingSync: false,
    });
    expect(repo.delete).toHaveBeenCalledWith(3);
    linkRepo.exists.mockResolvedValue(true);
    expect(await service.remove(5, 1, 3, 9)).toEqual({
      removed: true,
      pendingSync: true,
    });
    expect(repo.update).toHaveBeenCalledWith(3, {
      status: 'entered-in-error',
      updatedBy: 9,
    });
  });

  it('404 for another clinic encounter (negative)', async () => {
    encounterRepo.findOne.mockResolvedValue(null);
    await expect(service.list(5, 2)).rejects.toThrow(NotFoundException);
  });
});
