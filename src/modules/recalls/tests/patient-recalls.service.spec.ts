import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { PatientRecallsService } from '../patient-recalls.service';
import { PatientRecall, PatientRecallStatus } from '../entities/patient-recall.entity';
import { Reservation } from '../../reservations/entities/reservation.entity';
import { RecallIntervalsService } from '../recall-intervals.service';
import { ReservationStatus } from '../../../enums';

function buildQb(result: [any[], number] = [[], 0]) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
  };
}

describe('PatientRecallsService', () => {
  let service: PatientRecallsService;
  let recallRepo: { createQueryBuilder: jest.Mock; findOne: jest.Mock; save: jest.Mock };
  let reservationRepo: { find: jest.Mock };
  let intervalsService: { findMapForClinic: jest.Mock };
  let manager: { create: jest.Mock; save: jest.Mock };

  const clinicId = 1;

  beforeEach(async () => {
    recallRepo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      save: jest.fn((data) => Promise.resolve(data)),
    };
    reservationRepo = { find: jest.fn().mockResolvedValue([]) };
    intervalsService = { findMapForClinic: jest.fn() };
    manager = {
      create: jest.fn((entity, data) => data),
      save: jest.fn((entity, data) => Promise.resolve({ id: 1, ...data })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PatientRecallsService,
        { provide: getRepositoryToken(PatientRecall), useValue: recallRepo },
        { provide: getRepositoryToken(Reservation), useValue: reservationRepo },
        { provide: RecallIntervalsService, useValue: intervalsService },
      ],
    }).compile();

    service = module.get<PatientRecallsService>(PatientRecallsService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findAll', () => {
    it('attaches the nearest upcoming reservation per patient (positive)', async () => {
      const qb = buildQb([
        [{ id: 1, patientId: 10, dueDate: '2026-06-01' }],
        1,
      ]);
      recallRepo.createQueryBuilder.mockReturnValue(qb);
      reservationRepo.find.mockResolvedValue([
        { id: 99, patientId: 10, reservationDate: '2026-06-05' },
      ]);

      const result = await service.findAll(clinicId, {} as any);

      expect(result.data[0].upcomingReservation).toEqual({
        id: 99,
        reservationDate: '2026-06-05',
      });
    });

    it('sets upcomingReservation to null when the patient has none (negative/edge)', async () => {
      const qb = buildQb([[{ id: 1, patientId: 10 }], 1]);
      recallRepo.createQueryBuilder.mockReturnValue(qb);
      reservationRepo.find.mockResolvedValue([]);

      const result = await service.findAll(clinicId, {} as any);

      expect(result.data[0].upcomingReservation).toBeNull();
    });

    it('skips the reservation lookup entirely when there are no recalls (edge)', async () => {
      recallRepo.createQueryBuilder.mockReturnValue(buildQb([[], 0]));
      await service.findAll(clinicId, {} as any);
      expect(reservationRepo.find).not.toHaveBeenCalled();
    });

    it('filters reservation lookup to PENDING/CONFIRMED only (positive)', async () => {
      const qb = buildQb([[{ id: 1, patientId: 10 }], 1]);
      recallRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(clinicId, {} as any);

      expect(reservationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: expect.anything(),
          }),
        }),
      );
    });
  });

  describe('update', () => {
    it('stamps contactedAt/contactedBy when moving away from BELUM_DIHUBUNGI (positive)', async () => {
      recallRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId,
        status: PatientRecallStatus.BELUM_DIHUBUNGI,
      });

      const result = await service.update(
        1,
        clinicId,
        { status: PatientRecallStatus.SUDAH_DIHUBUNGI } as any,
        9,
      );

      expect(result.contactedAt).toBeInstanceOf(Date);
      expect(result.contactedBy).toBe(9);
    });

    it('clears contactedAt/contactedBy when reverting to BELUM_DIHUBUNGI (positive/edge)', async () => {
      recallRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId,
        status: PatientRecallStatus.SUDAH_DIHUBUNGI,
        contactedAt: new Date(),
        contactedBy: 5,
      });

      const result = await service.update(
        1,
        clinicId,
        { status: PatientRecallStatus.BELUM_DIHUBUNGI } as any,
        9,
      );

      expect(result.contactedAt).toBeNull();
      expect(result.contactedBy).toBeNull();
    });

    it('updates dueDate without touching status fields when only dueDate changes (positive)', async () => {
      recallRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId,
        status: PatientRecallStatus.BELUM_DIHUBUNGI,
        dueDate: '2026-01-01',
      });

      const result = await service.update(
        1,
        clinicId,
        { dueDate: '2026-02-01' } as any,
        9,
      );

      expect(result.dueDate).toBe('2026-02-01');
      expect(result.contactedAt).toBeUndefined();
    });

    it('throws NotFoundException when the recall does not exist (negative)', async () => {
      recallRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update(999, clinicId, {} as any, 9),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('scheduleFromBillingItems', () => {
    it('creates a recall due N days from today per configured tarif (positive)', async () => {
      intervalsService.findMapForClinic.mockResolvedValue(new Map([[1, 30]]));

      await service.scheduleFromBillingItems(
        manager as any,
        clinicId,
        7,
        [{ tarifId: 1, billingItemId: 100 }],
        9,
      );

      expect(manager.save).toHaveBeenCalledWith(
        PatientRecall,
        expect.objectContaining({
          patientId: 7,
          tarifId: 1,
          billingItemId: 100,
          status: PatientRecallStatus.BELUM_DIHUBUNGI,
        }),
      );
    });

    it('does nothing when the clinic has no recall intervals configured (negative/edge)', async () => {
      intervalsService.findMapForClinic.mockResolvedValue(new Map());
      await service.scheduleFromBillingItems(
        manager as any,
        clinicId,
        7,
        [{ tarifId: 1, billingItemId: 100 }],
        9,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('skips items without a tarifId (negative/edge)', async () => {
      intervalsService.findMapForClinic.mockResolvedValue(new Map([[1, 30]]));
      await service.scheduleFromBillingItems(
        manager as any,
        clinicId,
        7,
        [{ tarifId: null, billingItemId: 100 }],
        9,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });

    it('skips items whose tarif has no configured interval (negative/edge)', async () => {
      intervalsService.findMapForClinic.mockResolvedValue(new Map([[1, 30]]));
      await service.scheduleFromBillingItems(
        manager as any,
        clinicId,
        7,
        [{ tarifId: 999, billingItemId: 100 }],
        9,
      );
      expect(manager.save).not.toHaveBeenCalled();
    });
  });
});
