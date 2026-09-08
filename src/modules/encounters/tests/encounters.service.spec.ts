import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EncountersService } from '../encounters.service';
import { Encounter } from '../entities/encounter.entity';
import { Reservation } from '../../reservations/entities/reservation.entity';
import { EncounterStatus, ServiceType } from '../../../enums';
import { ReservationStatus } from '../../../enums/reservation-status.enum';
import { UserRole } from '../../../enums/user-role.enum';

describe('EncountersService', () => {
  let service: EncountersService;

  const mockEncounterRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    query: jest.fn(),
  };

  const mockReservationRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const owner = { userId: 1, role: UserRole.OWNER };
  const dokter = { userId: 7, role: UserRole.DOKTER };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncountersService,
        {
          provide: getRepositoryToken(Encounter),
          useValue: mockEncounterRepository,
        },
        {
          provide: getRepositoryToken(Reservation),
          useValue: mockReservationRepository,
        },
      ],
    }).compile();

    service = module.get<EncountersService>(EncountersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const clinicId = 1;
    const dto = {
      patientId: 5,
      practitionerId: 2,
      chiefComplaint: 'Sakit gigi',
    } as any;

    it('creates a walk-in encounter (no reservation) as ARRIVED (positive)', async () => {
      mockEncounterRepository.create.mockImplementation((e) => e);
      mockEncounterRepository.save.mockImplementation((e) =>
        Promise.resolve({ id: 1, ...e }),
      );

      const result = await service.create(clinicId, dto, owner.userId);

      expect(result.status).toBe(EncounterStatus.ARRIVED);
      expect(result.serviceType).toBe(ServiceType.OUTPATIENT);
      expect(mockReservationRepository.update).not.toHaveBeenCalled();
    });

    it('rejects check-in for a non-existent reservation (negative)', async () => {
      mockReservationRepository.findOne.mockResolvedValue(null);

      await expect(
        service.create(clinicId, { ...dto, reservationId: 99 }, owner.userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects check-in for a reservation that is not confirmed (negative)', async () => {
      mockReservationRepository.findOne.mockResolvedValue({
        id: 99,
        status: ReservationStatus.PENDING,
      });

      await expect(
        service.create(clinicId, { ...dto, reservationId: 99 }, owner.userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('checks in from a confirmed reservation and marks it completed (positive)', async () => {
      mockReservationRepository.findOne.mockResolvedValue({
        id: 99,
        status: ReservationStatus.CONFIRMED,
      });
      mockEncounterRepository.create.mockImplementation((e) => e);
      mockEncounterRepository.save.mockImplementation((e) =>
        Promise.resolve({ id: 2, ...e }),
      );

      await service.create(
        clinicId,
        { ...dto, reservationId: 99 },
        owner.userId,
      );

      expect(mockReservationRepository.update).toHaveBeenCalledWith(99, {
        status: ReservationStatus.COMPLETED,
      });
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when the encounter does not exist (negative)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(1, 1, owner)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("forbids a dokter from viewing another practitioner's encounter (negative)", async () => {
      mockEncounterRepository.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        practitionerId: 3,
      });
      mockEncounterRepository.query.mockResolvedValue([]);

      await expect(service.findOne(1, 1, dokter)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows a dokter to view their own encounter (positive)', async () => {
      const encounter = { id: 1, clinicId: 1, practitionerId: 3 };
      mockEncounterRepository.findOne.mockResolvedValue(encounter);
      mockEncounterRepository.query.mockResolvedValue([{ id: 3 }]);

      await expect(service.findOne(1, 1, dokter)).resolves.toBe(encounter);
    });

    it('returns the encounter for an owner/admin without ownership checks (positive)', async () => {
      const encounter = { id: 1, clinicId: 1, practitionerId: 3 };
      mockEncounterRepository.findOne.mockResolvedValue(encounter);

      await expect(service.findOne(1, 1, owner)).resolves.toBe(encounter);
      expect(mockEncounterRepository.query).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('throws NotFoundException when the encounter does not exist (negative)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          1,
          1,
          { status: EncounterStatus.IN_PROGRESS } as any,
          owner,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an illegal transition, e.g. arrived -> finished (negative)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: EncounterStatus.ARRIVED,
      });

      await expect(
        service.updateStatus(
          1,
          1,
          { status: EncounterStatus.FINISHED } as any,
          owner,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('requires a reason when cancelling (negative)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: EncounterStatus.ARRIVED,
      });

      await expect(
        service.updateStatus(
          1,
          1,
          { status: EncounterStatus.CANCELLED } as any,
          owner,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('advances arrived -> in_progress and stamps inProgressTime (positive)', async () => {
      const encounter = { id: 1, clinicId: 1, status: EncounterStatus.ARRIVED };
      mockEncounterRepository.findOne.mockResolvedValue(encounter);
      mockEncounterRepository.save.mockImplementation((e) =>
        Promise.resolve(e),
      );

      const result = await service.updateStatus(
        1,
        1,
        { status: EncounterStatus.IN_PROGRESS },
        owner,
      );

      expect(result.status).toBe(EncounterStatus.IN_PROGRESS);
      expect(result.inProgressTime).toBeInstanceOf(Date);
    });

    it("forbids a dokter from updating another practitioner's encounter (negative)", async () => {
      mockEncounterRepository.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: EncounterStatus.ARRIVED,
        practitionerId: 3,
      });
      mockEncounterRepository.query.mockResolvedValue([]);

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
    it('rejects editing a finished encounter (negative)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: EncounterStatus.FINISHED,
      });

      await expect(
        service.update(1, 1, { chiefComplaint: 'x' } as any, owner),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects editing a cancelled encounter (negative)', async () => {
      mockEncounterRepository.findOne.mockResolvedValue({
        id: 1,
        clinicId: 1,
        status: EncounterStatus.CANCELLED,
      });

      await expect(
        service.update(1, 1, { chiefComplaint: 'x' } as any, owner),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates an open encounter (positive)', async () => {
      const encounter = {
        id: 1,
        clinicId: 1,
        status: EncounterStatus.ARRIVED,
        chiefComplaint: 'Old',
      };
      mockEncounterRepository.findOne.mockResolvedValue(encounter);
      mockEncounterRepository.save.mockImplementation((e) =>
        Promise.resolve(e),
      );

      const result = await service.update(
        1,
        1,
        { chiefComplaint: 'Sakit gigi berdenyut' },
        owner,
      );

      expect(result.chiefComplaint).toBe('Sakit gigi berdenyut');
    });
  });
});
