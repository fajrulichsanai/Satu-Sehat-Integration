import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ClinicalAccessService } from '../../clinical-access/clinical-access.service';
import { SyncOrchestratorService } from '../../satusehat/sync/sync-orchestrator.service';
import { EncountersService } from '../encounters.service';
import { Encounter } from '../entities/encounter.entity';
import { Reservation } from '../../reservations/entities/reservation.entity';
import { EncounterStatus } from '../../../enums';
import { ReservationStatus } from '../../../enums/reservation-status.enum';
import { UserRole } from '../../../enums/user-role.enum';

function buildQb(result: [any[], number] = [[], 0], rawRows: any[] = []) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue(rawRows),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue(result),
  };
}

describe('EncountersService', () => {
  let syncOrchestrator: { syncEncounterInBackground: jest.Mock };
  let service: EncountersService;
  let encounterRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    query: jest.Mock;
  };
  let reservationRepo: { findOne: jest.Mock; update: jest.Mock };

  let clinicalAccess: { assertPatient: jest.Mock };
  const admin = { userId: 1, role: UserRole.ADMIN };
  const dokter = { userId: 2, role: UserRole.DOKTER };

  beforeEach(async () => {
    syncOrchestrator = {
      syncEncounterInBackground: jest.fn().mockResolvedValue(undefined),
    };
    encounterRepo = {
      createQueryBuilder: jest.fn(() => buildQb()),
      findOne: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => Promise.resolve({ id: 1, ...data })),
      query: jest.fn(),
    };
    reservationRepo = { findOne: jest.fn(), update: jest.fn() };
    clinicalAccess = {
      assertPatient: jest
        .fn()
        .mockRejectedValue(new ForbiddenException('bukan pasien Anda')),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncountersService,
        { provide: getRepositoryToken(Encounter), useValue: encounterRepo },
        { provide: getRepositoryToken(Reservation), useValue: reservationRepo },
        { provide: SyncOrchestratorService, useValue: syncOrchestrator },
        { provide: ClinicalAccessService, useValue: clinicalAccess },
      ],
    }).compile();

    service = module.get<EncountersService>(EncountersService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('findAll', () => {
    it('scopes DOKTER to only their own encounters via subquery (positive)', async () => {
      const qb = buildQb();
      encounterRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(1, {}, dokter);

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('practitioners WHERE user_id'),
        { uid: dokter.userId },
      );
    });

    it('filters by practitionerId for non-dokter roles (positive)', async () => {
      const qb = buildQb();
      encounterRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(1, { practitionerId: 7 }, admin);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'e.practitionerId = :practitionerId',
        { practitionerId: 7 },
      );
    });

    it('defaults to today when no date/open-status/unbilled filter is given (positive)', async () => {
      const qb = buildQb();
      encounterRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(1, {}, admin);

      const dateCalls = qb.andWhere.mock.calls.filter((c: any[]) =>
        c[0].includes('DATE(e.arrivedTime)'),
      );
      expect(dateCalls).toHaveLength(1);
    });

    it('does not force a today filter for an open-status query (ARRIVED) (edge)', async () => {
      const qb = buildQb();
      encounterRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(1, { status: EncounterStatus.ARRIVED }, admin);

      const dateCalls = qb.andWhere.mock.calls.filter((c: any[]) =>
        c[0].includes('DATE(e.arrivedTime)'),
      );
      expect(dateCalls).toHaveLength(0);
    });

    it('does not force a today filter for the unbilled backlog query (edge)', async () => {
      const qb = buildQb();
      encounterRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(1, { unbilled: true }, admin);

      const dateCalls = qb.andWhere.mock.calls.filter((c: any[]) =>
        c[0].includes('DATE(e.arrivedTime)'),
      );
      expect(dateCalls).toHaveLength(0);
      expect(qb.leftJoin).toHaveBeenCalled();
    });

    it('uses an explicit date filter when provided, overriding the default (positive)', async () => {
      const qb = buildQb();
      encounterRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(1, { date: '2026-01-01' }, admin);

      expect(qb.andWhere).toHaveBeenCalledWith('DATE(e.arrivedTime) = :date', {
        date: '2026-01-01',
      });
    });
  });

  describe('findAll (penelusuran per bulan)', () => {
    it('filters the whole month instead of defaulting to today (positive)', async () => {
      const qb = buildQb();
      encounterRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(1, { month: '2026-10' }, admin);

      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining("DATE_FORMAT(e.arrived_time, '%Y-%m')"),
        { month: '2026-10' },
      );
      const todayCalls = qb.andWhere.mock.calls.filter(
        (c: any[]) => c[0] === 'DATE(e.arrivedTime) = :date',
      );
      expect(todayCalls).toHaveLength(0);
    });

    it('returns per-status counts for the whole period and the days that have visits (positive)', async () => {
      const qb = buildQb(
        [[], 25],
        [
          { status: 'finished', count: '20', date: '2026-10-03' },
          { status: 'cancelled', count: '5' },
        ],
      );
      qb.getRawMany
        .mockResolvedValueOnce([
          { status: 'finished', count: '20' },
          { status: 'cancelled', count: '5' },
        ])
        .mockResolvedValueOnce([{ date: '2026-10-03', count: '4' }]);
      encounterRepo.createQueryBuilder.mockReturnValue(qb);

      const r: any = await service.findAll(1, { month: '2026-10' }, admin);

      expect(r.counts).toEqual({
        total: 25,
        arrived: 0,
        in_progress: 0,
        finished: 20,
        cancelled: 5,
      });
      expect(r.days).toEqual([{ date: '2026-10-03', count: 4 }]);
      expect(r.meta.total).toBe(25);
    });

    it('keeps the dokter scope on the counts and days queries too (negative)', async () => {
      const qb = buildQb();
      encounterRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(1, { month: '2026-10' }, dokter);

      const scoped = qb.andWhere.mock.calls.filter((c: any[]) =>
        String(c[0]).includes('practitioners WHERE user_id'),
      );
      // daftar + hitungan status + kalender tanggal
      expect(scoped).toHaveLength(3);
    });

    it('active=true limits to arrived + in_progress without forcing today (edge)', async () => {
      const qb = buildQb();
      encounterRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll(1, { active: true }, admin);

      expect(qb.andWhere).toHaveBeenCalledWith(
        'e.status IN (:...activeStatuses)',
        {
          activeStatuses: [
            EncounterStatus.ARRIVED,
            EncounterStatus.IN_PROGRESS,
          ],
        },
      );
      const todayCalls = qb.andWhere.mock.calls.filter(
        (c: any[]) => c[0] === 'DATE(e.arrivedTime) = :date',
      );
      expect(todayCalls).toHaveLength(0);
    });

    it('does not run the extra summary queries for the plain today list (edge)', async () => {
      const qb = buildQb();
      encounterRepo.createQueryBuilder.mockReturnValue(qb);

      const r: any = await service.findAll(1, {}, admin);

      expect(qb.getRawMany).not.toHaveBeenCalled();
      expect(r.counts).toBeUndefined();
      expect(r.days).toBeUndefined();
    });
  });

  describe('findOne', () => {
    it('returns the encounter for a non-dokter caller (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, practitionerId: 5 });
      const result = await service.findOne(1, 1, admin);
      expect(result.id).toBe(1);
    });

    it('throws NotFoundException when missing (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne(999, 1, admin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('allows a DOKTER to view their own encounter (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({ id: 1, practitionerId: 5 });
      encounterRepo.query.mockResolvedValue([{ id: 5 }]);
      const result = await service.findOne(1, 1, dokter);
      expect(result.id).toBe(1);
    });

    it('throws ForbiddenException when a DOKTER views another practitioner’s encounter of a patient that is not theirs (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue({
        id: 1,
        practitionerId: 5,
        patientId: 9,
      });
      encounterRepo.query.mockResolvedValue([]);
      await expect(service.findOne(1, 1, dokter)).rejects.toThrow(
        ForbiddenException,
      );
      expect(clinicalAccess.assertPatient).toHaveBeenCalledWith(dokter, 9);
    });

    it('lets a DOKTER read (not edit) another doctor’s encounter of their shared patient', async () => {
      encounterRepo.findOne.mockResolvedValue({
        id: 1,
        practitionerId: 5,
        patientId: 9,
      });
      encounterRepo.query.mockResolvedValue([]);
      clinicalAccess.assertPatient.mockResolvedValue(undefined);
      const r = await service.findOne(1, 1, dokter);
      expect((r as any).canEdit).toBe(false);
    });
  });

  describe('create', () => {
    const dto = {
      patientId: 1,
      practitionerId: 2,
      chiefComplaint: 'Sakit gigi',
    } as any;

    it('creates an ARRIVED encounter without a reservation (positive)', async () => {
      const result = await service.create(1, dto, 9);
      expect(result.status).toBe(EncounterStatus.ARRIVED);
      expect(reservationRepo.update).not.toHaveBeenCalled();
    });

    it('checks in from a CONFIRMED reservation and marks it COMPLETED (positive)', async () => {
      reservationRepo.findOne.mockResolvedValue({
        id: 10,
        clinicId: 1,
        status: ReservationStatus.CONFIRMED,
      });

      await service.create(1, { ...dto, reservationId: 10 }, 9);

      expect(reservationRepo.update).toHaveBeenCalledWith(10, {
        status: ReservationStatus.COMPLETED,
      });
    });

    it('throws NotFoundException when the reservation does not exist (negative)', async () => {
      reservationRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(1, { ...dto, reservationId: 999 }, 9),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the reservation is not CONFIRMED (negative)', async () => {
      reservationRepo.findOne.mockResolvedValue({
        id: 10,
        clinicId: 1,
        status: ReservationStatus.PENDING,
      });
      await expect(
        service.create(1, { ...dto, reservationId: 10 }, 9),
      ).rejects.toThrow(BadRequestException);
      expect(reservationRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('transitions ARRIVED -> IN_PROGRESS and stamps inProgressTime (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: EncounterStatus.ARRIVED,
        practitionerId: 2,
      });

      const result = await service.updateStatus(
        1,
        1,
        { status: EncounterStatus.IN_PROGRESS },
        admin,
      );

      expect(result.status).toBe(EncounterStatus.IN_PROGRESS);
      expect(result.inProgressTime).toBeInstanceOf(Date);
    });

    it('transitions IN_PROGRESS -> FINISHED and stamps finishedTime (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: EncounterStatus.IN_PROGRESS,
        practitionerId: 2,
      });

      const result = await service.updateStatus(
        1,
        1,
        { status: EncounterStatus.FINISHED },
        admin,
      );

      expect(result.finishedTime).toBeInstanceOf(Date);
    });

    it('cancels with a reason and records cancelledReason (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: EncounterStatus.ARRIVED,
        practitionerId: 2,
      });

      const result = await service.updateStatus(
        1,
        1,
        { status: EncounterStatus.CANCELLED, reason: 'Pasien batal' },
        admin,
      );

      expect(result.cancelledReason).toBe('Pasien batal');
    });

    it('throws BadRequestException when cancelling without a reason (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: EncounterStatus.ARRIVED,
        practitionerId: 2,
      });
      await expect(
        service.updateStatus(
          1,
          1,
          { status: EncounterStatus.CANCELLED } as any,
          admin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an illegal transition, e.g. ARRIVED -> FINISHED (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: EncounterStatus.ARRIVED,
        practitionerId: 2,
      });
      await expect(
        service.updateStatus(
          1,
          1,
          { status: EncounterStatus.FINISHED } as any,
          admin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects any transition out of a terminal FINISHED state (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: EncounterStatus.FINISHED,
        practitionerId: 2,
      });
      await expect(
        service.updateStatus(
          1,
          1,
          { status: EncounterStatus.IN_PROGRESS } as any,
          admin,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when encounter is missing (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus(
          999,
          1,
          { status: EncounterStatus.IN_PROGRESS } as any,
          admin,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when a DOKTER updates another practitioner’s encounter (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: EncounterStatus.ARRIVED,
        practitionerId: 5,
      });
      encounterRepo.query.mockResolvedValue([]);
      await expect(
        service.updateStatus(
          1,
          1,
          { status: EncounterStatus.IN_PROGRESS } as any,
          dokter,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('merges provided fields on an editable encounter (positive)', async () => {
      encounterRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: EncounterStatus.ARRIVED,
        practitionerId: 2,
        chiefComplaint: 'Old',
      });

      const result = await service.update(
        1,
        1,
        { chiefComplaint: 'New complaint' },
        admin,
      );

      expect(result.chiefComplaint).toBe('New complaint');
    });

    it('throws BadRequestException when encounter is already FINISHED (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: EncounterStatus.FINISHED,
        practitionerId: 2,
      });
      await expect(
        service.update(1, 1, { chiefComplaint: 'X' } as any, admin),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when encounter is missing (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue(null);
      await expect(service.update(999, 1, {} as any, admin)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when a DOKTER edits another practitioner’s encounter (negative)', async () => {
      encounterRepo.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: EncounterStatus.ARRIVED,
        practitionerId: 5,
      });
      encounterRepo.query.mockResolvedValue([]);
      await expect(service.update(1, 1, {} as any, dokter)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
